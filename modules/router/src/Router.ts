import { NextFunction } from 'express';
import { status } from '@grpc/grpc-js';
import ConduitGrpcSdk, {
  ConfigController,
  DatabaseProvider,
  GrpcCallback,
  GrpcRequest,
  HealthCheckStatus,
  ManagedModule,
  ConduitRouteObject,
  SocketProtoDescription,
  ConduitRouteActions,
  GrpcError,
  ConduitRouteParameters,
} from '@conduitplatform/grpc-sdk';
import path from 'path';
import {
  ConduitMiddleware,
  ConduitMiddlewareOptions,
  ConduitRequest,
  ConduitRoute,
  ConduitRoutingController,
  ConduitSocket,
  grpcToConduitRoute,
  ProtoGenerator,
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
import { NodeVM, VMScript } from 'vm2';

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
    [field: string]: RouteT[];
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
      return this.grpcSdk.database!.createSchemaFromAdapter(modelInstance);
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
    const storedMiddleware = await AppMiddleware.getInstance().findMany({});
    storedMiddleware.forEach(m =>
      this._internalRouter.setMiddlewareOwners(m.name, m.module),
    );
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
    if (moduleName) {
      processedRoutes.forEach(r => {
        if (r instanceof ConduitRoute && r.input.middlewares!.length !== 0) {
          r.input.middlewares!.forEach(m =>
            this._internalRouter.setMiddlewareOwners(m, moduleName),
          );
        }
      });
    }
    this.cleanupRoutes();
  }

  async patchMiddleware(
    call: GrpcRequest<PatchMiddlewareRequest>,
    callback: GrpcCallback<null>,
  ) {
    const { path, action, middleware } = call.request;
    const moduleName = call.metadata!.get('module-name')[0] as string;
    let injected: string[] = [];
    let removed: string[] = [];
    // Update grpcRoutes
    try {
      const route = this.getGrpcRoute(path, action)!;
      [injected, removed] = this._internalRouter.processMiddlewarePatch(
        route.options!.middlewares,
        middleware,
        moduleName,
      )!;
      this.setGrpcRouteMiddleware(path, action, middleware);
    } catch (e) {
      return callback({
        code: status.UNKNOWN,
        message: (e as Error).message,
      });
    }
    // Perform router patch, update state and save changes to db
    this._internalRouter.patchRouteMiddleware({
      path: path,
      action: action as ConduitRouteActions,
      middleware: middleware,
    });
    await this.updateStateForMiddlewarePatch(middleware, path, action);
    const storedMiddleware = await AppMiddleware.getInstance().findMany({ path, action });
    for (const m of storedMiddleware) {
      if (removed.includes(m.name)) {
        await AppMiddleware.getInstance().deleteOne({ _id: m._id });
      } else {
        await AppMiddleware.getInstance().findByIdAndUpdate(m._id, {
          position: middleware.indexOf(m.name),
        });
      }
    }
    for (const m of injected) {
      const conduitMiddleware: ConduitMiddleware =
        this._internalRouter.getConduitMiddleware(m)!;
      const query = {
        path: path,
        action: action,
        name: conduitMiddleware.name,
        description: conduitMiddleware.input.description,
        handler: conduitMiddleware.executeRequest.toString(),
        position: middleware.indexOf(m),
        module: moduleName,
      };
      await AppMiddleware.getInstance().create(query);
    }
    callback(null, null);
  }

  private async applyStoredMiddleware() {
    for (const key of Object.keys(this._grpcRoutes)) {
      if (this.hasAppliedMiddleware.includes(key)) {
        continue;
      }
      for (const r of this._grpcRoutes[key]) {
        const { path, action, middlewares } = r.options!; //todo: check thar r.options is defined
        const middleware = await AppMiddleware.getInstance().findMany({ path, action });
        if (middleware.length === 0) {
          continue;
        }
        const vm = new NodeVM({
          console: 'inherit',
          sandbox: {},
          require: { external: true },
        });
        for (const m of middleware) {
          //todo: a catch is missing somewhere in here
          const script = new VMScript(`module.exports = ${m.handler}`).compile();
          const handler = vm.run(script) as (
            request: ConduitRouteParameters,
          ) => Promise<any>;
          const input: ConduitMiddlewareOptions = {
            action: m.action as ConduitRouteActions,
            path: m.path,
            name: m.name,
            description: m.description,
          };
          const newMiddleware = new ConduitMiddleware(input, m.name, handler);
          this._internalRouter.registerRouteMiddleware(newMiddleware);
          middlewares.splice(m.position, 0, m.name);
        }
        await this.grpcSdk.admin.patchMiddleware(
          r.options!.path,
          r.options!.action as ConduitRouteActions,
          middlewares,
        );
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
          return { moduleIP: key, routeIndex: routeArray.indexOf(r) };
        }
      }
    }
    return null;
  }

  getGrpcRoute(path: string, action: string): RouteT | null {
    const position: { moduleIP: string; routeIndex: number } | null = this.findGrpcRoute(
      path,
      action,
    );
    if (!position) {
      return null;
    }
    return this._grpcRoutes[position.moduleIP][position.routeIndex];
  }

  setGrpcRouteMiddleware(path: string, action: string, middleware: string[]) {
    const position: { moduleIP: string; routeIndex: number } | null = this.findGrpcRoute(
      path,
      action,
    );
    if (!position) {
      throw Error('Route not found');
    }
    this._grpcRoutes[position.moduleIP][position.routeIndex].options!.middlewares =
      middleware;
  }

  registerRoute(route: ConduitRoute): void {
    this._sdkRoutes.push({ action: route.input.action, path: route.input.path });
    this._internalRouter.registerConduitRoute(route);
  }
}
