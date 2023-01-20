import { isNaN, isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import ConduitGrpcSdk, {
  ConduitError,
  ConduitRouteActions,
  GrpcServer,
  ConfigController,
  GrpcCallback,
  GrpcRequest,
  Indexable,
  ConduitRouteObject,
  SocketProtoDescription,
  merge,
  GrpcError,
  MiddlewareOrder,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitCommons,
  IConduitAdmin,
  GenerateProtoRequest,
  GenerateProtoResponse,
  RegisterAdminRouteRequest,
  RegisterAdminRouteRequest_PathDefinition,
  InjectMiddlewareRequest,
} from '@conduitplatform/commons';
import { hashPassword } from './utils/auth';
import { runMigrations } from './migrations';
import AdminConfigRawSchema from './config';
import * as middleware from './middleware';
import * as adminRoutes from './routes';
import * as models from './models';
import { protoTemplate, swaggerMetadata } from './hermes';
import path from 'path';
import {
  ConduitMiddleware,
  ConduitRequest,
  ConduitRoute,
  ConduitRoutingController,
  ConduitSocket,
  grpcToConduitRoute,
  RouteT,
  ProtoGenerator,
} from '@conduitplatform/hermes';
import AppConfigSchema, { Config as ConfigSchema } from './config';
import convict from 'convict';
import { Response, NextFunction, Request } from 'express';
import helmet from 'helmet';
import { generateConfigDefaults } from './utils/config';
import metricsSchema from './metrics';

export default class AdminModule extends IConduitAdmin {
  grpcSdk: ConduitGrpcSdk;
  private _router: ConduitRoutingController;
  private _sdkRoutes: ConduitRoute[];
  private readonly _grpcRoutes: {
    [field: string]: RegisterAdminRouteRequest_PathDefinition[];
  } = {};
  readonly config: convict.Config<ConfigSchema> = convict(AppConfigSchema);

  constructor(readonly commons: ConduitCommons, grpcSdk: ConduitGrpcSdk) {
    super(commons);
    this.grpcSdk = grpcSdk;
    ProtoGenerator.getInstance(protoTemplate);
    this._router = new ConduitRoutingController(
      this.getHttpPort()!,
      this.getSocketPort()!,
      '/',
      this.grpcSdk,
      1000,
      swaggerMetadata,
      { registeredRoutes: { name: 'admin_routes_total' } },
    );
    this._grpcRoutes = {};
    this._sdkRoutes = [
      adminRoutes.getLoginRoute(),
      adminRoutes.getCreateAdminRoute(),
      adminRoutes.getAdminRoute(),
      adminRoutes.getAdminsRoute(),
      adminRoutes.deleteAdminUserRoute(),
      adminRoutes.changePasswordRoute(),
      adminRoutes.getReadyRoute(),
      adminRoutes.toggleTwoFaRoute(),
      adminRoutes.verifyQrCodeRoute(),
      adminRoutes.verifyTwoFaRoute(),
      adminRoutes.changeUsersPasswordRoute(),
      adminRoutes.injectMiddleware(this.grpcSdk),
    ];
    this.registerMetrics();
  }

  private getHttpPort() {
    const value = process.env['ADMIN_HTTP_PORT'] ?? '3030';
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
    const value = process.env['ADMIN_SOCKET_PORT'] ?? '3031';
    const port = parseInt(value, 10);
    if (isNaN(port)) {
      ConduitGrpcSdk.Logger.error(`Invalid Socket port value: ${port}`);
      process.exit(-1);
    }
    if (port >= 0) {
      return port;
    }
  }

  async initialize(server: GrpcServer) {
    const previousConfig =
      (await this.commons.getConfigManager().get('admin')) ?? this.config.getProperties();
    await generateConfigDefaults(previousConfig);
    ConfigController.getInstance().config = await this.commons
      .getConfigManager()
      .configurePackage('admin', previousConfig, AdminConfigRawSchema);
    await server.addService(
      path.resolve(__dirname, '../../core/src/core.proto'),
      'conduit.core.Admin',
      {
        generateProto: this.generateProto.bind(this),
        registerAdminRoute: this.registerAdminRoute.bind(this),
        injectMiddleware: this.injectMiddleware.bind(this),
      },
    );
    this.grpcSdk
      .waitForExistence('database')
      .then(this.handleDatabase.bind(this))
      .catch(e => {
        ConduitGrpcSdk.Logger.error(e.message);
      });
  }

  private registerAdminRoutes() {
    this._sdkRoutes.forEach(route => {
      this._router.registerConduitRoute(route);
    }, this);
  }

  async subscribeToBusEvents() {
    this.grpcSdk.bus!.subscribe('admin:config:update', (config: string) => {
      const cfg: convict.Config<any> = JSON.parse(config);
      this.handleConfigUpdate(cfg);
    });
    ConfigController.getInstance().config = await this.commons
      .getConfigManager()
      .get('admin');
    this.onConfig();
    // Register Middleware
    this._router.registerMiddleware(
      (req: ConduitRequest, res: Response, next: NextFunction) => {
        req['conduit'] = {};
        next();
      },
      true,
    );
    this._router.registerMiddleware(middleware.getAdminMiddleware(this.commons), true);
    this._router.registerMiddleware(
      middleware.getAuthMiddleware(this.grpcSdk, this.commons),
      true,
    );
    this._router.registerMiddleware(helmet(), false);
    this._router.registerMiddleware((req: Request, res: Response, next: NextFunction) => {
      if (
        (req.url.startsWith('/graphql') || req.url.startsWith('/swagger')) &&
        req.method === 'GET'
      ) {
        res.removeHeader('Content-Security-Policy');
      }
      next();
    }, false);
  }

  /** Used to update the configuration on the same Core instance (Redis broadcast limitation). */
  handleConfigUpdate(config: convict.Config<any>) {
    ConfigController.getInstance().config = config;
    this.onConfig();
  }

  protected onConfig() {
    let restEnabled = ConfigController.getInstance().config.transports.rest;
    const graphqlEnabled = ConfigController.getInstance().config.transports.graphql;
    if (!restEnabled && !graphqlEnabled) {
      ConduitGrpcSdk.Logger.warn(
        'Cannot disable both REST and GraphQL admin transport APIs. Falling back to REST...',
      );
      restEnabled = true;
    }
    if (restEnabled) {
      this._router.initRest();
    } else {
      this._router.stopRest();
    }
    if (graphqlEnabled) {
      this._router.initGraphQL();
    } else {
      this._router.stopGraphQL();
    }
    if (ConfigController.getInstance().config.transports.sockets) {
      this._router.initSockets();
    } else {
      this._router.stopSockets();
    }
  }

  private registerMetrics() {
    Object.values(metricsSchema).forEach(metric => {
      ConduitGrpcSdk.Metrics?.registerMetric(metric.type, metric.config);
    });
  }

  // grpc
  async generateProto(
    call: GrpcRequest<GenerateProtoRequest>,
    callback: GrpcCallback<GenerateProtoResponse>,
  ) {
    const moduleName = call.request.moduleName;
    const routes: (ConduitRouteObject | SocketProtoDescription)[] =
      call.request.routes.map(r => JSON.parse(r));
    try {
      const generatedProto = ProtoGenerator.getInstance().generateProtoFile(
        moduleName,
        routes,
      );
      return callback(null, generatedProto);
    } catch (err) {
      ConduitGrpcSdk.Logger.error(err as Error);
      return callback({ code: status.INTERNAL, message: 'Well that failed :/' });
    }
  }

  async registerAdminRoute(
    call: GrpcRequest<RegisterAdminRouteRequest>,
    callback: GrpcCallback<null>,
  ) {
    const moduleName = call.metadata!.get('module-name')[0];
    try {
      if (!call.request.routerUrl) {
        const result = this.commons
          .getConfigManager()!
          .getModuleUrlByName(call.metadata!.get('module-name')![0] as string);
        if (!result) {
          return callback({
            code: status.INTERNAL,
            message: 'Error when registering routes',
          });
        }
        call.request.routerUrl = result;
      }
      this.internalRegisterRoute(
        call.request.protoFile,
        call.request.routes,
        call.request.routerUrl,
        moduleName as string,
      );
      this.updateState(
        call.request.protoFile,
        call.request.routes,
        call.request.routerUrl,
        moduleName as string,
      );
    } catch (err) {
      ConduitGrpcSdk.Logger.error(err as Error);
      return callback({
        code: status.INTERNAL,
        message: 'Error when registering routes',
      });
    }
    callback(null, null);
  }

  async injectMiddleware(
    call: GrpcRequest<InjectMiddlewareRequest>,
    callback: GrpcCallback<null>,
  ) {
    const { path, action, name, position } = call.request;
    const middleware = new ConduitMiddleware({}, name, async () => {}); // TODO: remove this
    let middlewareArray: string[] | undefined;

    outer: for (const key of Object.keys(this._grpcRoutes)) {
      const routesArray = this._grpcRoutes[key];
      for (const r of routesArray) {
        if (r.options?.path !== path || r.options?.action !== action) {
          continue;
        }
        if (r.options?.middlewares.includes(name)) {
          return callback({
            code: status.ALREADY_EXISTS,
            message: `Middleware ${name} already assigned to ${action} ${path}`,
          });
        }
        if (position === MiddlewareOrder.FIRST) {
          r.options?.middlewares.unshift(name);
        } else {
          r.options?.middlewares.push(name);
        }
        middlewareArray = r.options.middlewares;
        break outer;
      }
    }
    if (!middlewareArray) {
      return callback({
        code: status.NOT_FOUND,
        message: `Route ${action} ${path} not found`,
      });
    }
    this._router.registerRouteMiddleware(middleware);
    this._router.patchRouteMiddleware(
      path,
      action as ConduitRouteActions,
      name,
      position as MiddlewareOrder,
    );
    await this.updateStateForMiddlewarePatch(middlewareArray, path, action);
    callback(null, null);
  }

  registerRoute(route: ConduitRoute): void {
    this._sdkRoutes.push(route);
    this._router.registerConduitRoute(route);
    this.cleanupRoutes();
  }

  private async highAvailability() {
    const r = await this.grpcSdk.state!.getKey('admin');
    if (!r || r.length === 0) {
      this.cleanupRoutes();
      return;
    }
    const state = JSON.parse(r);
    if (state.routes) {
      const promises = state.routes.map((r: Indexable) => {
        try {
          if (r.moduleName) {
            return this.commons
              .getConfigManager()
              .isModuleUp(r.moduleName)
              .then(isUp => {
                if (isUp) {
                  return this.internalRegisterRoute(
                    r.protofile,
                    r.routes,
                    r.url,
                    r.moduleName,
                  );
                }
              });
          }
          return this.internalRegisterRoute(r.protofile, r.routes, r.url);
        } catch (err) {
          ConduitGrpcSdk.Logger.error(err as Error);
        }
      }, this);
      ConduitGrpcSdk.Logger.log('Recovered routes');
      await Promise.all(promises);
    }

    this.grpcSdk.bus!.subscribe('admin', (message: string) => {
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
      this.cleanupRoutes();
    });
  }

  private updateState(
    protofile: string,
    routes: RegisterAdminRouteRequest_PathDefinition[],
    url: string,
    moduleName?: string,
  ) {
    this.grpcSdk
      .state!.getKey('admin')
      .then((r: any) => {
        const state = !r || r.length === 0 ? {} : JSON.parse(r);
        if (!state.routes) state.routes = [];
        let index;
        (state.routes as Indexable[]).forEach((val, i) => {
          if (val.url === url) {
            index = i;
          }
        });
        if (index) {
          state.routes[index] = { protofile, routes, url, moduleName };
        } else {
          state.routes.push({
            protofile,
            routes,
            url,
            moduleName,
          });
        }
        return this.grpcSdk.state!.setKey('admin', JSON.stringify(state));
      })
      .then(() => {
        this.publishAdminRouteData(protofile, routes, url, moduleName);
        ConduitGrpcSdk.Logger.log('Updated state');
      })
      .catch(() => {
        ConduitGrpcSdk.Logger.error('Failed to update state');
      });
  }

  private async updateStateForMiddlewarePatch(
    middleware: string[],
    path: string,
    action: string,
  ) {
    await this.grpcSdk
      .state!.getKey('admin')
      .then(result => {
        const routes = JSON.parse(result!).routes as any[];
        outer: for (const v of routes) {
          for (const r of v.routes) {
            if (r.options?.path !== path && r.options.action !== action) {
              continue;
            }
            r.options.middlewares = middleware;
            break outer;
          }
        }
        return this.grpcSdk.state!.setKey('admin', JSON.stringify({ routes: routes }));
      })
      .catch(() => {
        throw new GrpcError(
          status.INTERNAL,
          'Failed to update state for patched middleware',
        );
      });
  }

  private publishAdminRouteData(
    protofile: string,
    routes: RegisterAdminRouteRequest_PathDefinition[],
    url: string,
    moduleName?: string,
  ) {
    this.grpcSdk.bus!.publish(
      'admin',
      JSON.stringify({
        protofile,
        routes,
        url,
        moduleName,
      }),
    );
  }

  private async handleDatabase() {
    await this.registerSchemas();
    await runMigrations(this.grpcSdk);
    models.Admin.getInstance()
      .findOne({ username: 'admin' })
      .then(async existing => {
        if (isNil(existing)) {
          const hashRounds = ConfigController.getInstance().config.auth.hashRounds;
          return hashPassword('admin', hashRounds);
        }
        return Promise.resolve(null);
      })
      .then((result: string | null) => {
        if (!isNil(result)) {
          return models.Admin.getInstance().create({
            username: 'admin',
            password: result,
            isSuperAdmin: true,
          });
        }
      })
      .catch(e => ConduitGrpcSdk.Logger.log(e));
    this.registerAdminRoutes();
    this.highAvailability().catch(() => {
      ConduitGrpcSdk.Logger.error('Failed to recover state');
    });
  }

  private internalRegisterRoute(
    protofile: any,
    routes: RegisterAdminRouteRequest_PathDefinition[],
    url: string,
    moduleName?: string,
  ) {
    const processedRoutes: (ConduitRoute | ConduitMiddleware | ConduitSocket)[] =
      grpcToConduitRoute(
        'Admin',
        {
          protoFile: protofile,
          routes: routes as RouteT[],
          routerUrl: url,
        },
        moduleName,
        this.grpcSdk.grpcToken,
      );

    processedRoutes.forEach(r => {
      if (r instanceof ConduitRoute) {
        ConduitGrpcSdk.Logger.http(
          `New admin route registered: ${r.input.action} ${r.input.path} handler url: ${url}`,
        );
        this._router.registerConduitRoute(r);
      }
    });
    this._grpcRoutes[url] = routes;
    this.cleanupRoutes();
  }

  private cleanupRoutes() {
    const routes: { action: string; path: string }[] = [];
    // Admin routes
    routes.push(
      { action: ConduitRouteActions.POST, path: '/login' },
      { action: ConduitRouteActions.GET, path: '/modules' },
    );
    // Package routes
    this._sdkRoutes.forEach((route: ConduitRoute) => {
      routes.push({ action: route.input.action, path: route.input.path });
    });
    // Module routes
    Object.keys(this._grpcRoutes).forEach((grpcRoute: string) => {
      const routesArray = this._grpcRoutes[grpcRoute];
      routes.push(
        ...routesArray.map((route: any) => {
          return { action: route.options.action, path: route.options.path };
        }),
      );
    });
    this._router.cleanupRoutes(routes);
  }

  private registerSchemas() {
    const promises = Object.values(models).map(model => {
      const modelInstance = model.getInstance(this.grpcSdk.database!);
      return this.grpcSdk.database!.createSchemaFromAdapter(modelInstance);
    });
    return Promise.all(promises);
  }

  async setConfig(moduleConfig: any): Promise<any> {
    const previousConfig = await this.commons.getConfigManager().get('admin');
    const config = merge(previousConfig, moduleConfig);
    await generateConfigDefaults(config);
    try {
      this.config.load(config).validate({
        allowed: 'strict',
      });
    } catch (e) {
      (this.config as unknown) = convict(AppConfigSchema);
      this.config.load(previousConfig);
      throw new ConduitError('INVALID_ARGUMENT', 400, (e as Error).message);
    }
    this.grpcSdk.bus!.publish('core:config:update', JSON.stringify(config));
    ConfigController.getInstance().config = config;
    return config;
  }
}
