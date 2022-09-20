import { Router, NextFunction } from 'express';
import { status } from '@grpc/grpc-js';
import ConduitGrpcSdk, {
  ConfigController,
  DatabaseProvider,
  GrpcCallback,
  GrpcRequest,
  Indexable,
  HealthCheckStatus,
  ManagedModule,
} from '@conduitplatform/grpc-sdk';
import path from 'path';
import {
  ConduitMiddleware,
  ConduitRequest,
  ConduitRoute,
  ConduitRoutingController,
  ConduitSocket,
  grpcToConduitRoute,
  RouteT,
  SocketPush,
  SwaggerRouterMetadata,
} from '@conduitplatform/hermes';
import { isNaN, isNil } from 'lodash';
import AppConfigSchema, { Config } from './config';
import * as models from './models';
import { runMigrations } from './migrations';
import SecurityModule from './security';
import { AdminHandlers } from './admin';
import {
  RegisterConduitRouteRequest,
  RegisterConduitRouteRequest_PathDefinition,
  SocketData,
} from './protoTypes/router';
import * as adminRoutes from './admin/routes';
import metricsSchema from './metrics';

const swaggerRouterMetadata: SwaggerRouterMetadata = {
  urlPrefix: '',
  securitySchemes: {
    clientId: {
      name: 'clientid',
      type: 'apiKey',
      in: 'header',
      description: 'A security client id, retrievable through [POST] /security/client',
    },
    clientSecret: {
      name: 'clientSecret',
      type: 'apiKey',
      in: 'header',
      description:
        'A security client secret, retrievable through [POST] /security/client',
    },
    userToken: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'Bearer',
      description:
        'A user authentication token, retrievable through [POST] /authentication/local or [POST] /authentication/renew',
    },
  },
  globalSecurityHeaders: [
    {
      clientId: [],
      clientSecret: [],
    },
  ],
  setExtraRouteHeaders(route: ConduitRoute, swaggerRouteDoc: Indexable): void {
    if (route.input.middlewares?.includes('authMiddleware')) {
      swaggerRouteDoc.security[0].userToken = [];
    }
  },
};

export default class ConduitDefaultRouter extends ManagedModule<Config> {
  configSchema = AppConfigSchema;
  protected metricsSchema = metricsSchema;
  service = {
    protoPath: path.resolve(__dirname, 'router.proto'),
    protoDescription: 'router.Router',
    functions: {
      setConfig: this.setConfig.bind(this),
      registerConduitRoute: this.registerGrpcRoute.bind(this),
      socketPush: this.socketPush.bind(this),
    },
  };
  private _internalRouter: ConduitRoutingController;
  private _security: SecurityModule;
  private adminRouter: AdminHandlers;
  private readonly _routes: string[];
  private readonly _globalMiddlewares: string[];
  private _grpcRoutes: {
    [field: string]: RouteT[];
  } = {};
  private _sdkRoutes: { path: string; action: string }[] = [];
  private database: DatabaseProvider;

  constructor() {
    super('router');
    this.updateHealth(HealthCheckStatus.UNKNOWN, true);
    this._routes = [];
    this._globalMiddlewares = [];
  }

  async onServerStart() {
    await this.grpcSdk.waitForExistence('database');
    this.database = this.grpcSdk.databaseProvider!;
    await this.registerSchemas();
    await runMigrations(this.grpcSdk);
    this._internalRouter = new ConduitRoutingController(
      this.getHttpPort()!,
      this.getSocketPort()!,
      '',
      this.grpcSdk,
      1000,
      swaggerRouterMetadata,
      { registeredRoutes: { name: 'client_routes_total' } },
    );
    this.registerGlobalMiddleware(
      'conduitRequestMiddleware',
      (req: ConduitRequest, res: Response, next: NextFunction) => {
        req['conduit'] = {};
        next();
      },
      true,
    );
  }

  async onRegister() {
    this.adminRouter = new AdminHandlers(this.grpcServer, this.grpcSdk, this);
    this._security = new SecurityModule(this.grpcSdk, this);
  }

  protected registerSchemas() {
    const promises = Object.values(models).map(model => {
      const modelInstance = model.getInstance(this.grpcSdk.database!);
      return this.grpcSdk.database!.createSchemaFromAdapter(modelInstance);
    });
    return Promise.all(promises);
  }
  async preConfig(config: Config) {
    if (config.hostUrl === '' || isNil(config.hostUrl)) {
      config.hostUrl = `http://localhost:${process.env['CLIENT_HTTP_PORT'] ?? '3000'}`;
    }
    return config;
  }

  async onConfig() {
    let atLeastOne = false;

    if (ConfigController.getInstance().config.transports.graphql) {
      this._internalRouter.initGraphQL();
      atLeastOne = true;
    } else {
      this._internalRouter.stopGraphQL();
    }

    if (ConfigController.getInstance().config.transports.rest) {
      this._internalRouter.initRest();
      atLeastOne = true;
    } else {
      this._internalRouter.stopRest();
    }

    if (ConfigController.getInstance().config.transports.sockets) {
      atLeastOne = true;
      this._internalRouter.initSockets(
        this.grpcSdk.redisDetails.host,
        this.grpcSdk.redisDetails.port,
      );
    } else {
      this._internalRouter.stopSockets();
    }

    if (atLeastOne) {
      this._security.setupMiddlewares();
    }
    if (!this._sdkRoutes.some(r => r.path === '/ready')) {
      this.registerRoute(adminRoutes.getReadyRoute());
    }
    await this.highAvailability();
    this.updateHealth(HealthCheckStatus.SERVING);
  }

  private getHttpPort() {
    const value = process.env['CLIENT_HTTP_PORT'] ?? '3000';
    const port = parseInt(value, 10);
    if (isNaN(port)) {
      ConduitGrpcSdk.Logger.error(`Invalid HTTP port value: ${port}`);
      process.exit(-1);
    }
    if (port >= 0) {
      return port;
    }
  }

  private getSocketPort() {
    const value = process.env['CLIENT_SOCKET_PORT'] ?? '3001';
    const port = parseInt(value, 10);
    if (isNaN(port)) {
      ConduitGrpcSdk.Logger.error(`Invalid Socket port value: ${port}`);
      process.exit(-1);
    }
    if (port >= 0) {
      return port;
    }
  }

  private async recoverFromState() {
    const r = await this.grpcSdk.state!.getKey('router');
    if (!r || r.length === 0) return;
    const state = JSON.parse(r);
    if (state.routes) {
      state.routes.forEach((r: any) => {
        try {
          this.internalRegisterRoute(r.protofile, r.routes, r.url);
        } catch (err) {
          ConduitGrpcSdk.Logger.error(err as Error);
        }
      });
      ConduitGrpcSdk.Logger.log('Recovered routes');
    }
  }

  async highAvailability() {
    await this.recoverFromState();
    this.grpcSdk.bus!.subscribe('router', (message: string) => {
      const messageParsed = JSON.parse(message);
      try {
        this.internalRegisterRoute(
          messageParsed.protofile,
          messageParsed.routes,
          messageParsed.url,
        );
      } catch (err) {
        ConduitGrpcSdk.Logger.error(err as Error);
      }
    });
  }

  updateState(
    protofile: string,
    routes: RegisterConduitRouteRequest_PathDefinition[],
    url: string,
  ) {
    this.grpcSdk
      .state!.getKey('router')
      .then(r => {
        const state = !r || r.length === 0 ? {} : JSON.parse(r);
        if (!state.routes) state.routes = [];
        let index;
        (state.routes as any[]).forEach((val, i) => {
          if (val.url === url) {
            index = i;
          }
        });
        if (index) {
          state.routes[index] = { protofile, routes, url };
        } else {
          state.routes.push({
            protofile,
            routes,
            url,
          });
        }
        return this.grpcSdk.state!.setKey('router', JSON.stringify(state));
      })
      .then(() => {
        this.publishAdminRouteData(protofile, routes, url);
        ConduitGrpcSdk.Logger.log('Updated state');
      })
      .catch(() => {
        ConduitGrpcSdk.Logger.error('Failed to update state');
      });
  }

  publishAdminRouteData(
    protofile: string,
    routes: RegisterConduitRouteRequest_PathDefinition[],
    url: string,
  ) {
    this.grpcSdk.bus!.publish(
      'router',
      JSON.stringify({
        protofile,
        routes,
        url,
      }),
    );
  }

  async initializeMetrics() {
    // @improve-metrics
    // TODO: This should initialize 'client_routes_total' as it's called on [POST] @ /metrics/reset
    const securityClients = await models.Client.getInstance().findMany({});
    const clientPlatforms: Map<string, number> = new Map();
    securityClients.forEach(client => {
      const currentValue = clientPlatforms.get(client.platform.toLowerCase()) ?? 0;
      clientPlatforms.set(client.platform.toLowerCase(), currentValue + 1);
    });
    clientPlatforms.forEach((clients, platformName) => {
      ConduitGrpcSdk.Metrics?.set('security_clients_total', clients, {
        platform: platformName,
      });
    });
  }

  async registerGrpcRoute(
    call: GrpcRequest<RegisterConduitRouteRequest>,
    callback: GrpcCallback<null>,
  ) {
    const moduleName = call.metadata!.get('module-name')[0];
    try {
      if (!call.request.routerUrl) {
        const result = await this.grpcSdk.config.getModuleUrlByName(
          call.metadata!.get('module-name')![0] as string,
        );
        if (!result) {
          return callback({
            code: status.INTERNAL,
            message: 'Error when registering routes',
          });
        }
        call.request.routerUrl = result.url;
      }

      this.internalRegisterRoute(
        call.request.protoFile,
        call.request.routes as RouteT[],
        call.request.routerUrl,
        moduleName as string,
      );
      this.updateState(
        call.request.protoFile,
        call.request.routes,
        call.request.routerUrl,
      );
    } catch (err) {
      ConduitGrpcSdk.Logger.error(err as Error);
      return callback({ code: status.INTERNAL, message: 'Well that failed :/' });
    }

    //todo definitely missing an error handler here
    //perhaps wrong(?) we send an empty response
    callback(null, undefined);
  }

  internalRegisterRoute(
    protofile: string,
    routes: RouteT[],
    url: string,
    moduleName?: string,
  ) {
    const processedRoutes: (ConduitRoute | ConduitMiddleware | ConduitSocket)[] =
      grpcToConduitRoute(
        'Router',
        {
          protoFile: protofile,
          routes: routes,
          routerUrl: url,
        },
        moduleName === 'core' ? undefined : moduleName,
        this.grpcSdk.grpcToken,
      );
    this._grpcRoutes[url] = routes;
    this._internalRouter.registerRoutes(processedRoutes, url);
    this.cleanupRoutes();
  }

  async socketPush(call: GrpcRequest<SocketData>, callback: GrpcCallback<null>) {
    try {
      const socketData: SocketPush = {
        event: call.request.event,
        data: JSON.parse(call.request.data),
        receivers: call.request.receivers,
        rooms: call.request.rooms,
        namespace: `/${call.metadata!.get('module-name')[0]}/`,
      };
      await this._internalRouter.socketPush(socketData);
    } catch (err) {
      ConduitGrpcSdk.Logger.error(err as Error);
      return callback({ code: status.INTERNAL, message: 'Well that failed :/' });
    }

    //todo definitely missing an error handler here
    //perhaps wrong(?) we send an empty response
    callback(null, undefined);
  }

  cleanupRoutes() {
    const routes: { action: string; path: string }[] = [];
    Object.keys(this._grpcRoutes).forEach((grpcRoute: string) => {
      const routesArray = this._grpcRoutes[grpcRoute];
      routes.push(
        ...routesArray.map(route => {
          return { action: route.options.action, path: route.options.path };
        }),
      );
    });
    routes.push(...this._sdkRoutes);
    this._internalRouter.cleanupRoutes(routes);
  }

  registerGlobalMiddleware(
    name: string,
    middleware: any,
    socketMiddleware: boolean = false,
  ) {
    this._globalMiddlewares.push(name);
    this._internalRouter.registerMiddleware(middleware, socketMiddleware);
  }

  getRegisteredRoutes() {
    return this._routes;
  }

  getGrpcRoutes() {
    return this._grpcRoutes;
  }

  registerRoute(route: ConduitRoute): void {
    this._sdkRoutes.push({ action: route.input.action, path: route.input.path });
    this._internalRouter.registerConduitRoute(route);
  }
}
