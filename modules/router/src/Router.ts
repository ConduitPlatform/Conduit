import { NextFunction } from 'express';
import { status } from '@grpc/grpc-js';
import ConduitGrpcSdk, {
  ConduitRouteObject,
  ConfigController,
  DatabaseProvider,
  GrpcCallback,
  GrpcRequest,
  HealthCheckStatus,
  ManagedModule,
  SocketProtoDescription,
  ConduitRouteActions,
  GrpcError,
  UntypedArray,
} from '@conduitplatform/grpc-sdk';
import path from 'path';
import {
  ConduitMiddleware,
  ConduitRequest,
  ConduitRoute,
  ConduitRoutingController,
  ConduitSocket,
  grpcToConduitRoute,
  ProtoGenerator,
  ProxyRoute,
  ProxyRouteT,
  proxyToConduitRoute,
  RouteT,
  SocketPush,
} from '@conduitplatform/hermes';
import { isNaN } from 'lodash';
import AppConfigSchema, { Config } from './config';
import * as models from './models';
import { protoTemplate, swaggerMetadata } from './hermes';
import { runMigrations } from './migrations';
import SecurityModule from './security';
import { AdminHandlers } from './admin';
import {
  GenerateProtoRequest,
  GenerateProtoResponse,
  PatchMiddlewareRequest,
  RegisterConduitRouteRequest,
  RegisterConduitRouteRequest_PathDefinition,
  SocketData,
} from './protoTypes/router';
import * as adminRoutes from './admin/routes';
import metricsSchema from './metrics';
import { AppMiddleware } from './models';

export default class ConduitDefaultRouter extends ManagedModule<Config> {
  configSchema = AppConfigSchema;
  protected metricsSchema = metricsSchema;
  service = {
    protoPath: path.resolve(__dirname, 'router.proto'),
    protoDescription: 'router.Router',
    functions: {
      setConfig: this.setConfig.bind(this),
      generateProto: this.generateProto.bind(this),
      registerConduitRoute: this.registerGrpcRoute.bind(this),
      patchMiddleware: this.patchMiddleware.bind(this),
      socketPush: this.socketPush.bind(this),
    },
  };
  private _internalRouter: ConduitRoutingController;
  private _security: SecurityModule;
  private adminRouter: AdminHandlers;
  private readonly _routes: string[];
  private readonly _globalMiddlewares: string[];
  private _grpcRoutes: {
    [field: string]: RouteT[] | ProxyRouteT[];
  } = {};
  private _sdkRoutes: { path: string; action: string }[] = [];
  private database: DatabaseProvider;
  private hasAppliedMiddleware: string[] = [];

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
    ProtoGenerator.getInstance(protoTemplate);
    this._internalRouter = new ConduitRoutingController(
      this.getHttpPort()!,
      this.getSocketPort()!,
      '',
      this.grpcSdk,
      1000,
      swaggerMetadata,
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
      return this.grpcSdk
        .database!.createSchemaFromAdapter(modelInstance)
        .then(() => this.database.migrate(modelInstance.name));
    });
    return Promise.all(promises);
  }

  async preConfig(config: Config) {
    if (config.hostUrl === '') {
      config.hostUrl =
        process.env.__DEFAULT_HOST_URL ??
        `http://localhost:${process.env['CLIENT_HTTP_PORT'] ?? '3000'}`;
    }
    return config;
  }

  async onConfig() {
    const config = ConfigController.getInstance().config;
    let atLeastOne = false;
    if (config.transports.graphql) {
      this._internalRouter.initGraphQL();
      atLeastOne = true;
    } else {
      this._internalRouter.stopGraphQL();
    }
    if (config.transports.rest) {
      this._internalRouter.initRest();
      atLeastOne = true;
    } else {
      this._internalRouter.stopRest();
    }
    if (config.transports.proxy) {
      this._internalRouter.initProxy();
      atLeastOne = true;
    } else {
      this._internalRouter.stopProxy();
    }
    if (config.transports.sockets) {
      this._internalRouter.initSockets();
      atLeastOne = true;
    } else {
      this._internalRouter.stopSockets();
    }

    if (atLeastOne) {
      this._security.setupMiddlewares();
    }
    if (!this._sdkRoutes.some(r => r.path === '/ready')) {
      this.registerRoute(adminRoutes.getReadyRoute());
    }
    this.grpcSdk.createModuleClient('router', process.env.SERVICE_IP!);
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
    const proxyRoutes = await models.RouterProxyRoute.getInstance().findMany({});
    if ((!r || r.length === 0) && (!proxyRoutes || proxyRoutes.length === 0)) return;
    if (r) {
      const state = JSON.parse(r);
      if (state.routes) {
        state.routes.forEach((r: any) => {
          try {
            this.internalRegisterRoute(r.protofile, r.routes, r.url);
          } catch (err) {
            ConduitGrpcSdk.Logger.error(err as Error);
          }
        });
      }
    }
    const proxies: ProxyRouteT[] = [];
    if (proxyRoutes) {
      proxyRoutes.forEach(route => {
        proxies.push({
          options: {
            path: route.path,
            action: route.action,
            description: route.description,
            middlewares: route.middlewares,
          },
          proxy: {
            target: route.target,
            ...route.proxyMiddlewareOptions,
          },
        });
      });
      this.internalRegisterRoute(undefined, proxies, 'router', 'router');
    }
    ConduitGrpcSdk.Logger.log('Recovered routes');
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
    await this.applyStoredMiddleware();
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
        (state.routes as UntypedArray).forEach((val, i) => {
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

  private async updateStateForMiddlewarePatch(
    middleware: string[],
    path: string,
    action: string,
  ) {
    await this.grpcSdk
      .state!.getKey('router')
      .then(result => {
        const stateRoutes = JSON.parse(result!).routes as {
          protofile: string;
          routes: RegisterConduitRouteRequest_PathDefinition[];
          url: string;
        }[];
        let index = 0;
        outer: for (const obj of stateRoutes) {
          for (const r of obj.routes) {
            if (r.options?.path !== path || r.options.action !== action) {
              continue;
            }
            r.options.middlewares = middleware;
            stateRoutes[index] = obj;
            break outer;
          }
          index++;
        }
        return this.grpcSdk.state!.setKey(
          'router',
          JSON.stringify({ routes: stateRoutes }),
        );
      })
      .catch(() => {
        throw new GrpcError(
          status.INTERNAL,
          'Failed to update state for patched middleware',
        );
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
    // 'client_routes_total' updated via Hermes
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
        call.request.routes as RouteT[] | ProxyRouteT[],
        call.request.routerUrl,
        moduleName as string,
      );

      this.updateState(
        call.request.protoFile,
        call.request.routes,
        call.request.routerUrl,
      );
      await this.applyStoredMiddleware();
    } catch (err) {
      ConduitGrpcSdk.Logger.error(err as Error);
      return callback({ code: status.INTERNAL, message: 'Well that failed :/' });
    }

    //todo definitely missing an error handler here
    //perhaps wrong(?) we send an empty response
    callback(null, undefined);
  }

  internalRegisterRoute(
    protofile: string | undefined,
    routes: RouteT[] | ProxyRouteT[],
    url: string,
    moduleName?: string,
  ) {
    const proxyRoutes: ProxyRouteT[] = [];
    const regularRoutes: RouteT[] = [];
    for (const route of routes) {
      if ((route as ProxyRouteT).options && (route as ProxyRouteT)?.proxy) {
        proxyRoutes.push(route as ProxyRouteT);
      } else {
        regularRoutes.push(route as RouteT);
      }
    }
    let processedRoutes: (
      | ConduitRoute
      | ConduitMiddleware
      | ConduitSocket
      | ProxyRoute
    )[] = [];
    if (proxyRoutes && proxyRoutes.length > 0) {
      processedRoutes = proxyToConduitRoute(proxyRoutes, 'router');
    }
    if (regularRoutes.length > 0) {
      if (!protofile) {
        throw new Error('Protofile is required');
      }
      processedRoutes = grpcToConduitRoute(
        'Router',
        {
          protoFile: protofile,
          routes: regularRoutes as RouteT[],
          routerUrl: url,
        },
        moduleName === 'core' ? undefined : moduleName,
        this.grpcSdk.grpcToken,
      );
      this._grpcRoutes[url] = routes;
    }
    this._internalRouter.registerRoutes(processedRoutes, url);
    this.cleanupRoutes();
  }

  async patchMiddleware(
    call: GrpcRequest<PatchMiddlewareRequest>,
    callback: GrpcCallback<null>,
  ) {
    const { path, action, middleware } = call.request;
    const moduleUrl = await this.grpcSdk.config.getModuleUrlByName(
      call.metadata!.get('module-name')![0] as string,
    );
    if (!moduleUrl) {
      return callback({
        code: status.INTERNAL,
        message: 'Something went wrong',
      });
    }
    await this.internalPatchMiddleware(path, action, middleware, moduleUrl.url).catch(
      e => {
        return callback({
          code: status.INTERNAL,
          message: (e as Error).message,
        });
      },
    );
  }

  async internalPatchMiddleware(
    path: string,
    action: string,
    middleware: string[],
    moduleUrl?: string,
  ) {
    let injected: string[] = [];
    let removed: string[] = [];
    if (!moduleUrl) {
      moduleUrl = await this.grpcSdk.config.getModuleUrlByName('core').then(r => r.url);
    }
    const { url, routeIndex } = this.findGrpcRoute(path, action);
    const route = this.getGrpcRoute(url, routeIndex);
    [injected, removed] = this._internalRouter.processMiddlewarePatch(
      route.options!.middlewares,
      middleware,
      moduleUrl!,
    )!;
    this.setGrpcRouteMiddleware(url, routeIndex, middleware);
    this._internalRouter.patchRouteMiddleware({
      path: path,
      action: action as ConduitRouteActions,
      middleware: middleware,
    });
    await this.updateStateForMiddlewarePatch(middleware, path, action);
    const storedMiddleware = await AppMiddleware.getInstance().findMany({ path, action });
    for (const m of storedMiddleware) {
      if (removed.includes(m.middleware)) {
        await AppMiddleware.getInstance().deleteOne({ _id: m._id });
      } else {
        await AppMiddleware.getInstance().findByIdAndUpdate(m._id, {
          position: middleware.indexOf(m.middleware),
        });
      }
    }
    for (const m of injected) {
      await AppMiddleware.getInstance().create({
        path: path,
        action: action,
        middleware: m,
        position: middleware.indexOf(m),
        owner: moduleUrl,
      });
    }
  }

  private async applyStoredMiddleware() {
    for (const key of Object.keys(this._grpcRoutes)) {
      if (this.hasAppliedMiddleware.includes(key)) {
        continue;
      }
      for (const r of this._grpcRoutes[key]) {
        const { path, action, middlewares } = r.options!;
        const storedMiddleware = await AppMiddleware.getInstance().findMany({
          path,
          action,
        });
        if (storedMiddleware.length === 0) {
          continue;
        }
        for (const m of storedMiddleware) {
          if (m.position !== middlewares.indexOf(m.middleware)) {
            middlewares.splice(m.position, 0, m.middleware);
          }
        }
        await this.internalPatchMiddleware(
          r.options!.path,
          r.options!.action as ConduitRouteActions,
          middlewares,
        ).catch(() => {});
        this.hasAppliedMiddleware.push(key);
      }
    }
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

  findGrpcRoute(path: string, action: string) {
    for (const key of Object.keys(this._grpcRoutes)) {
      const routeArray = this._grpcRoutes[key];
      for (const r of routeArray) {
        if (r.options.path === path && r.options.action === action) {
          return { url: key, routeIndex: routeArray.indexOf(r as RouteT & ProxyRouteT) };
        }
      }
    }
    throw new GrpcError(status.NOT_FOUND, `Grpc route ${action} ${path} not found`);
  }

  getGrpcRoute(url: string, routeIndex: number) {
    return this._grpcRoutes[url][routeIndex];
  }

  setGrpcRouteMiddleware(url: string, routeIndex: number, middleware: string[]) {
    this._grpcRoutes[url][routeIndex].options!.middlewares = middleware;
  }

  registerRoute(route: ConduitRoute): void {
    this._sdkRoutes.push({ action: route.input.action, path: route.input.path });
    this._internalRouter.registerConduitRoute(route);
  }
}
