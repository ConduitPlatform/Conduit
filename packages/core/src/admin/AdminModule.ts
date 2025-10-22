import { isNaN, isNil } from 'lodash-es';
import { status } from '@grpc/grpc-js';
import {
  ConduitError,
  ConduitGrpcSdk,
  ConduitRouteActions,
  GrpcCallback,
  GrpcError,
  GrpcRequest,
  IConduitLogger,
  Indexable,
} from '@conduitplatform/grpc-sdk';
import {
  PatchRouteMiddlewaresRequest,
  RegisterAdminRouteRequest,
  RegisterAdminRouteRequest_PathDefinition,
} from '../interfaces/index.js';
import { hashPassword } from './utils/auth.js';
import AdminConfigRawSchema from './config/index.js';
import AppConfigSchema, { Config as ConfigSchema } from './config/index.js';
import * as middleware from './middleware/index.js';
import * as adminRoutes from './routes/index.js';
import * as configRoutes from './routes/index.js';
import * as models from '../models/index.js';
import { AdminMiddleware } from '../models/index.js';
import { getSwaggerMetadata } from './hermes/index.js';
import path from 'path';
import {
  ConduitMiddleware,
  ConduitRequest,
  ConduitRoute,
  ConduitRoutingController,
  ConduitSocket,
  grpcToConduitRoute,
  RouteT,
} from '@conduitplatform/hermes';
import convict from 'convict';
import { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { generateConfigDefaults } from './utils/config.js';
import metricsSchema from './metrics/index.js';
import cors from 'cors';
import { ConfigController, GrpcServer, merge } from '@conduitplatform/module-tools';
import { fileURLToPath } from 'node:url';

export default class AdminModule {
  grpcSdk: ConduitGrpcSdk;
  readonly config: convict.Config<ConfigSchema> = convict(AppConfigSchema);
  private _router!: ConduitRoutingController;
  private _sdkRoutes: ConduitRoute[] = [
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
    adminRoutes.patchRouteMiddlewares(this),
    adminRoutes.getRouteMiddlewares(this),
    configRoutes.getModulesRoute(),
  ];
  private readonly _grpcRoutes: {
    [field: string]: RegisterAdminRouteRequest_PathDefinition[];
  } = {};
  private databaseHandled = false;
  private hasAppliedMiddleware: string[] = [];
  private _refreshTimeout: NodeJS.Timeout | null = null;
  private configManager: any;

  constructor(grpcSdk: ConduitGrpcSdk, configManager: any) {
    this.grpcSdk = grpcSdk;
    this.configManager = configManager;
    this._router = new ConduitRoutingController(
      this.getHttpPort()!,
      this.getSocketPort()!,
      '/',
      this.grpcSdk,
      1000,
      getSwaggerMetadata,
      { registeredRoutes: { name: 'admin_routes_total' } },
    );
    this._grpcRoutes = {};
    this.registerMetrics();
  }

  async initialize(server: GrpcServer) {
    const previousConfig =
      (await this.configManager.get('admin')) ?? this.config.getProperties();
    await generateConfigDefaults(previousConfig);
    ConfigController.getInstance().config = await this.configManager.configurePackage(
      'admin',
      previousConfig,
      AdminConfigRawSchema,
    );
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    await server.addService(
      path.resolve(__dirname, '../core.proto'),
      'conduit.core.Admin',
      {
        registerAdminRoute: this.registerAdminRoute.bind(this),
        patchRouteMiddlewares: this.patchRouteMiddlewares.bind(this),
      },
    );
  }

  async subscribeToBusEvents() {
    this.grpcSdk.bus!.subscribe('admin:config:update', (config: string) => {
      const cfg: convict.Config<any> = JSON.parse(config);
      this.handleConfigUpdate(cfg);
    });
    ConfigController.getInstance().config = await this.configManager.get('admin');
    this.onConfig();
    this._router.registerMiddleware((req: Request, res: Response, next: NextFunction) => {
      const config = ConfigController.getInstance().config;
      if (config.cors.enabled === false) return next();
      cors({
        origin: config.cors.origin.includes(',')
          ? config.cors.origin.split(',')
          : config.cors.origin,
        credentials: config.cors.credentials,
        methods: config.cors.methods,
        allowedHeaders: config.cors.allowedHeaders,
        exposedHeaders: config.cors.exposedHeaders,
        maxAge: config.cors.maxAge,
      })(req, res, next);
    }, true);
    // Register Middleware
    this._router.registerMiddleware(
      (req: ConduitRequest, res: Response, next: NextFunction) => {
        req['conduit'] = {};
        next();
      },
      true,
    );
    this._router.registerMiddleware(
      middleware.getAdminMiddleware(this.configManager),
      true,
    );

    this._router.registerMiddleware(
      middleware.getAuthMiddleware(this.grpcSdk, this.configManager),
      true,
    );
    this._router.registerMiddleware(helmet(), false);
    this._router.registerMiddleware((req: Request, res: Response, next: NextFunction) => {
      if (
        (req.url.startsWith('/graphql') ||
          req.url.startsWith('/swagger') ||
          req.url.startsWith('/reference')) &&
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

  async registerAdminRoute(
    call: GrpcRequest<RegisterAdminRouteRequest>,
    callback: GrpcCallback<null>,
  ) {
    const moduleName = call.metadata!.get('module-name')[0];
    try {
      if (!call.request.routerUrl) {
        const result = this.configManager.getModuleUrlByName(
          call.metadata!.get('module-name')![0] as string,
        );
        if (!result) {
          return callback({
            code: status.INTERNAL,
            message: 'Error when registering routes',
          });
        }
        call.request.routerUrl = result;
      }
      this.internalRegisterRoute(
        call.request.routes,
        call.request.routerUrl!,
        moduleName as string,
      );
      this.updateState(
        call.request.routes,
        call.request.routerUrl!,
        moduleName as string,
      );
      if (this.databaseHandled) {
        this.scheduleMiddlewareApply();
      }
    } catch (err) {
      ConduitGrpcSdk.Logger.error(err as Error);
      return callback({
        code: status.INTERNAL,
        message: 'Error when registering routes',
      });
    }
    callback(null, null);
  }

  registerRoute(route: ConduitRoute): void {
    this._sdkRoutes.push(route);
    this._router.registerConduitRoute(route);
    this.cleanupRoutes();
  }

  registerConfigRoutes(moduleName: string, configSchema: any) {
    this.registerRoute(configRoutes.getMonoConfigRoute(this.grpcSdk));
    this.registerRoute(
      configRoutes.getModuleConfigRoute(this.grpcSdk, moduleName, configSchema),
    );
    this.registerRoute(
      configRoutes.setModuleConfigRoute(
        this.grpcSdk,
        this.configManager,
        moduleName,
        configSchema,
      ),
    );
  }

  public internalRegisterRoute(
    routes: RegisterAdminRouteRequest_PathDefinition[],
    url: string,
    moduleName?: string,
  ) {
    let processedRoutes: (ConduitRoute | ConduitMiddleware | ConduitSocket)[] = [];

    const regularRoutes: RegisterAdminRouteRequest_PathDefinition[] = [];
    for (const route of routes) {
      regularRoutes.push(route as RegisterAdminRouteRequest_PathDefinition);
    }
    if (regularRoutes.length > 0) {
      processedRoutes = grpcToConduitRoute(
        'Admin',
        {
          routes: regularRoutes as RouteT[],
          routerUrl: url,
        },
        moduleName,
        this.grpcSdk.grpcToken,
      );
    }

    processedRoutes.forEach(r => {
      if (r instanceof ConduitRoute) {
        (ConduitGrpcSdk.Logger as IConduitLogger).http(
          `New admin route registered: ${r.input.action} ${r.input.path} handler url: ${url}`,
        );
        this._router.registerConduitRoute(r);
      }
    });
    // @ts-ignore
    this._grpcRoutes[url] = routes;
    this.cleanupRoutes();
  }

  async setConfig(moduleConfig: any) {
    const previousConfig = await this.configManager.get('admin');
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

  protected onConfig() {
    let restEnabled = ConfigController.getInstance().config.transports.rest;
    const graphqlEnabled = ConfigController.getInstance().config.transports.graphql;
    const proxyEnabled = ConfigController.getInstance().config.transports.proxy;
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

  private registerAdminRoutes() {
    this._sdkRoutes.forEach(route => {
      this._router.registerConduitRoute(route);
    }, this);
  }

  private registerMetrics() {
    Object.values(metricsSchema).forEach(metric => {
      ConduitGrpcSdk.Metrics?.registerMetric(metric.type, metric.config);
    });
  }

  private async highAvailability() {
    const r = await this.grpcSdk.state!.getState();
    if (!r || r.length === 0) {
      this.cleanupRoutes();
      return;
    }
    if (r) {
      const state = JSON.parse(r);
      if (state.routes) {
        const promises = state.routes.map((r: Indexable) => {
          try {
            if (r.moduleName) {
              return this.configManager.isModuleUp(r.moduleName).then((isUp: boolean) => {
                if (isUp) {
                  return this.internalRegisterRoute(r.routes, r.url, r.moduleName);
                }
              });
            }
            return this.internalRegisterRoute(r.protofile, r.routes, r.url);
          } catch (err) {
            ConduitGrpcSdk.Logger.error(err as Error);
          }
        }, this);
        await Promise.all(promises);
      }
    }
    ConduitGrpcSdk.Logger.log('Recovered routes');

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
    routes: RegisterAdminRouteRequest_PathDefinition[],
    url: string,
    moduleName?: string,
  ) {
    this.grpcSdk.state
      ?.modifyState(async (existingState: Indexable) => {
        const state = existingState ?? {};
        if (!state.routes) state.routes = [];
        let index;
        (state.routes as Indexable[]).forEach((val, i) => {
          if (val.url === url) {
            index = i;
          }
        });
        if (index) {
          state.routes[index] = { routes, url, moduleName };
        } else {
          state.routes.push({
            routes,
            url,
            moduleName,
          });
        }
        return state;
      })
      .then(() => {
        this.publishAdminRouteData(routes, url, moduleName);
        ConduitGrpcSdk.Logger.log('Updated state');
      })
      .catch(() => {
        ConduitGrpcSdk.Logger.error('Failed to update state');
      });
  }

  private publishAdminRouteData(
    routes: RegisterAdminRouteRequest_PathDefinition[],
    url: string,
    moduleName?: string,
  ) {
    this.grpcSdk.bus!.publish(
      'admin',
      JSON.stringify({
        routes,
        url,
        moduleName,
      }),
    );
  }

  public async handleDatabase() {
    // Models are already registered/migrated by ConfigManager
    // Only handle admin-specific database operations
    this.scheduleMiddlewareApply();
    this.databaseHandled = true;
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

  async patchRouteMiddlewares(
    call: GrpcRequest<PatchRouteMiddlewaresRequest>,
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
    callback(null, null);
  }

  async _patchRouteMiddlewares(
    path: string,
    action: string,
    middlewares: string[],
    moduleUrl?: string,
  ) {
    let injected: string[] = [];
    let removed: string[] = [];
    /* When moduleUrl is missing, the function is triggered by the admin patchRouteMiddlewares endpoint handler
    moduleUrl is used for permission checks when removing a middleware that belongs to another module from a route */
    if (!moduleUrl) {
      moduleUrl = await this.grpcSdk.config.getModuleUrlByName('core').then(r => r.url);
    }
    const { url, routeIndex } = this.findGrpcRoute(path, action);
    const route = this.getGrpcRoute(url, routeIndex)!;
    [injected, removed] = this._router.filterMiddlewaresPatch(
      route.options!.middlewares,
      middlewares,
      moduleUrl!,
    )!;
    this.setGrpcRouteMiddleware(url, routeIndex, middlewares);
    this._router.patchRouteMiddlewares({
      path: path,
      action: action as ConduitRouteActions,
      middlewares: middlewares,
    });
    await this.updateStateForMiddlewarePatch(middlewares, path, action);
    const storedMiddlewares = await AdminMiddleware.getInstance().findMany({
      path,
      action,
    });
    for (const m of storedMiddlewares) {
      if (removed.includes(m.middleware)) {
        await AdminMiddleware.getInstance().deleteOne({ _id: m._id });
      } else {
        await AdminMiddleware.getInstance().findByIdAndUpdate(m._id, {
          position: middlewares.indexOf(m.middleware),
        });
      }
    }
    for (const m of injected) {
      await AdminMiddleware.getInstance().create({
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
      await ConduitGrpcSdk.Sleep(500);
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
        if (r.isMiddleware) {
          continue;
        }
        const storedMiddleware = await AdminMiddleware.getInstance().findMany({
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
    await this.grpcSdk
      .state!.getKey('admin')
      .then(result => {
        const stateRoutes = JSON.parse(result!).routes as {
          protofile: string;
          routes: RegisterAdminRouteRequest_PathDefinition[];
          url: string;
          moduleName: string;
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
          'admin',
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

  findGrpcRoute(path: string, action: string) {
    for (const key of Object.keys(this._grpcRoutes)) {
      const routeArray = this._grpcRoutes[key];
      for (const r of routeArray) {
        if (r.options?.path === path && r.options.action === action) {
          return { url: key, routeIndex: routeArray.indexOf(r) };
        }
      }
    }
    throw new GrpcError(status.NOT_FOUND, `Grpc route ${action} ${path} not found`);
  }

  getGrpcRoute(
    url: string,
    routeIndex: number,
  ): RegisterAdminRouteRequest_PathDefinition {
    return this._grpcRoutes[url][routeIndex];
  }

  setGrpcRouteMiddleware(url: string, routeIndex: number, middleware: string[]) {
    this._grpcRoutes[url][routeIndex].options!.middlewares = middleware;
  }
}
