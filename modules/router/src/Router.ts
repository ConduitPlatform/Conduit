import { NextFunction } from 'express';
import { status } from '@grpc/grpc-js';
import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  DatabaseProvider,
  GrpcCallback,
  GrpcError,
  GrpcRequest,
  HealthCheckStatus,
  Indexable,
  sleep,
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
  RouteT,
  SocketPush,
} from '@conduitplatform/hermes';
import { isNaN } from 'lodash-es';
import AppConfigSchema, { Config } from './config/index.js';
import * as models from './models/index.js';
import { AppMiddleware } from './models/index.js';
import { getSwaggerMetadata } from './hermes/index.js';
import { runMigrations } from './migrations/index.js';
import SecurityModule from './security/index.js';
import { AdminHandlers } from './admin/index.js';
import {
  PatchAppRouteMiddlewaresRequest,
  RegisterConduitRouteRequest,
  RegisterConduitRouteRequest_PathDefinition,
  SocketData,
} from './protoTypes/router.js';
import * as adminRoutes from './admin/routes/index.js';
import metricsSchema from './metrics/index.js';
import { ConfigController, ManagedModule } from '@conduitplatform/module-tools';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class ConduitDefaultRouter extends ManagedModule<Config> {
  configSchema = AppConfigSchema;
  service = {
    protoPath: path.resolve(__dirname, 'router.proto'),
    protoDescription: 'router.Router',
    functions: {
      registerConduitRoute: this.registerGrpcRoute.bind(this),
      socketPush: this.socketPush.bind(this),
      patchRouteMiddlewares: this.patchRouteMiddlewares.bind(this),
    },
  };
  protected metricsSchema = metricsSchema;
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
  private hasAppliedMiddleware: string[] = [];
  private _refreshTimeout: NodeJS.Timeout | null = null;

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
      getSwaggerMetadata,
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
    await this.highAvailability();
    this.updateHealth(HealthCheckStatus.SERVING);
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
    this.scheduleMiddlewareApply();
  }

  updateState(routes: RegisterConduitRouteRequest_PathDefinition[], url: string) {
    this.grpcSdk
      .state!.modifyState(async (existingState: Indexable) => {
        const state = existingState ?? {};
        if (!state.routes) state.routes = [];
        let index;
        (state.routes as UntypedArray).forEach((val, i) => {
          if (val.url === url) {
            index = i;
          }
        });
        if (index) {
          state.routes[index] = { routes, url };
        } else {
          state.routes.push({
            routes,
            url,
          });
        }
        return state;
      })
      .then(() => {
        this.publishRouteData(routes, url);
        ConduitGrpcSdk.Logger.log('Updated routes state');
      })
      .catch(e => {
        console.error(e);
        ConduitGrpcSdk.Logger.error('Failed to update routes state');
      });
  }

  publishRouteData(routes: RegisterConduitRouteRequest_PathDefinition[], url: string) {
    this.grpcSdk.bus!.publish(
      'router',
      JSON.stringify({
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
        call.request.routes as RouteT[],
        call.request.routerUrl,
        moduleName as string,
      );

      this.updateState(call.request.routes, call.request.routerUrl);
      this.scheduleMiddlewareApply();
    } catch (err) {
      ConduitGrpcSdk.Logger.error(err as Error);
      return callback({ code: status.INTERNAL, message: 'Well that failed :/' });
    }

    //todo definitely missing an error handler here
    //perhaps wrong(?) we send an empty response
    callback(null, undefined);
  }

  internalRegisterRoute(routes: RouteT[], url: string, moduleName?: string) {
    const regularRoutes: RouteT[] = [];
    for (const route of routes) {
      regularRoutes.push(route as RouteT);
    }
    let processedRoutes: (ConduitRoute | ConduitMiddleware | ConduitSocket)[] = [];
    if (regularRoutes.length > 0) {
      processedRoutes = grpcToConduitRoute(
        'Router',
        {
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

  async socketPush(call: GrpcRequest<SocketData>, callback: GrpcCallback<null>) {
    try {
      const socketData: SocketPush = {
        event: call.request.event,
        data: call.request.data ? JSON.parse(call.request.data) : undefined,
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

  protected registerSchemas(): Promise<unknown> {
    const promises = Object.values(models).map(model => {
      const modelInstance = model.getInstance(this.grpcSdk.database!);
      return this.grpcSdk
        .database!.createSchemaFromAdapter(modelInstance)
        .then(() => this.database.migrate(modelInstance.name));
    });
    return Promise.all(promises);
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
    const r = await this.grpcSdk.state!.getState();
    if (!r || r.length === 0) return;
    if (r) {
      const state = JSON.parse(r);
      if (state.routes) {
        state.routes.forEach((r: any) => {
          try {
            this.internalRegisterRoute(r.routes, r.url);
          } catch (err) {
            ConduitGrpcSdk.Logger.error(err as Error);
          }
        });
      }
    }
    ConduitGrpcSdk.Logger.log('Recovered routes');
  }

  async patchRouteMiddlewares(
    call: GrpcRequest<PatchAppRouteMiddlewaresRequest>,
    callback: GrpcCallback<null>,
  ) {
    const { path, action, middlewares } = call.request;
    const moduleUrl = await this.grpcSdk.config.getModuleUrlByName(
      call.metadata!.get('module-name')![0] as string,
    );
    if (!moduleUrl) {
      return callback({
        code: status.INTERNAL,
        message: 'Something went wrong',
      });
    }
    await this._patchRouteMiddlewares(path, action, middlewares, moduleUrl.url).catch(
      e => {
        return callback({
          code: status.INTERNAL,
          message: (e as Error).message,
        });
      },
    );
  }

  async _patchRouteMiddlewares(
    path: string,
    action: string,
    middlewares: string[],
    moduleUrl?: string,
  ) {
    let injected: string[] = [];
    let removed: string[] = [];
    /* When moduleUrl is missing, the function is triggered by the router's patchRouteMiddlewares endpoint handler
     moduleUrl is used for permission checks when removing a middleware that belongs to another module from a route */
    if (!moduleUrl) {
      moduleUrl = await this.grpcSdk.config.getModuleUrlByName('router').then(r => r.url);
    }
    const { url, routeIndex } = this.findGrpcRoute(path, action);
    const route = this.getGrpcRoute(url, routeIndex);
    [injected, removed] = this._internalRouter.filterMiddlewaresPatch(
      route.options!.middlewares,
      middlewares,
      moduleUrl!,
    )!;
    this.setGrpcRouteMiddleware(url, routeIndex, middlewares);
    this._internalRouter.patchRouteMiddlewares({
      path: path,
      action: action as ConduitRouteActions,
      middlewares: middlewares,
    });
    await this.updateStateForMiddlewarePatch(middlewares, path, action);
    const storedMiddlewares = await AppMiddleware.getInstance().findMany({
      path,
      action,
    });
    for (const m of storedMiddlewares) {
      if (removed.includes(m.middleware)) {
        await AppMiddleware.getInstance().deleteOne({ _id: m._id });
      } else {
        await AppMiddleware.getInstance().findByIdAndUpdate(m._id, {
          position: middlewares.indexOf(m.middleware),
        });
      }
    }
    for (const m of injected) {
      await AppMiddleware.getInstance().create({
        path: path,
        action: action,
        middleware: m,
        position: middlewares.indexOf(m),
        owner: moduleUrl,
      });
    }
  }

  scheduleMiddlewareApply() {
    if (this._refreshTimeout) {
      clearTimeout(this._refreshTimeout);
      this._refreshTimeout = null;
    }
    this._refreshTimeout = setTimeout(() => {
      try {
        this.applyStoredMiddleware();
      } catch (err) {
        ConduitGrpcSdk.Logger.error(err as Error);
      }
      this._refreshTimeout = null;
    }, 3000);
  }

  private async applyStoredMiddleware() {
    const threshold = 10000;
    const start = Date.now();
    while (this.grpcSdk.database?.active === false && Date.now() - start < threshold) {
      await sleep(500);
    }
    if (this.grpcSdk.database?.active === false) {
      ConduitGrpcSdk.Logger.error(
        'Database is not active, cannot apply stored middleware',
      );
      return;
    }
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
        await this._patchRouteMiddlewares(
          r.options!.path,
          r.options!.action as ConduitRouteActions,
          middlewares,
        ).catch(() => {});
        this.hasAppliedMiddleware.push(key);
      }
    }
  }

  private async updateStateForMiddlewarePatch(
    middleware: string[],
    path: string,
    action: string,
  ) {
    this.grpcSdk
      .state!.modifyState(async (existingState: Indexable) => {
        const state = existingState ?? {};
        if (!state.routes) state.routes = [];
        const stateRoutes = state!.routes as {
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
        state.routes = stateRoutes;
        return state;
      })
      .then(() => {
        ConduitGrpcSdk.Logger.log('Updated state for patched middleware');
      })
      .catch(e => {
        console.error(e);
        throw new GrpcError(
          status.INTERNAL,
          'Failed to update state for patched middleware',
        );
      });
  }

  findGrpcRoute(path: string, action: string) {
    for (const key of Object.keys(this._grpcRoutes)) {
      const routeArray = this._grpcRoutes[key];
      for (const r of routeArray) {
        if (r.options.path === path && r.options.action === action) {
          return { url: key, routeIndex: routeArray.indexOf(r as RouteT) };
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
}
