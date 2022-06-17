import { Router } from 'express';
import { status } from '@grpc/grpc-js';
import {
  ConfigController,
  DatabaseProvider,
  GrpcCallback,
  GrpcRequest,
  HealthCheckStatus,
  ManagedModule,
} from '@conduitplatform/grpc-sdk';
import path from 'path';
import {
  ConduitMiddleware,
  ConduitRoute,
  ConduitRoutingController,
  ConduitSocket,
  grpcToConduitRoute,
  RouteT,
  SocketPush,
} from '@conduitplatform/hermes';
import { isNaN } from 'lodash';
import AppConfigSchema, { Config } from './config';
import * as models from './models';
import { runMigrations } from './migrations';
import SecurityModule from './security';
import { AdminHandlers } from './admin/admin';
import {
  RegisterConduitRouteRequest,
  RegisterConduitRouteRequest_PathDefinition,
  SocketData,
} from './protoTypes/router';

export default class ConduitDefaultRouter extends ManagedModule<Config> {
  config = AppConfigSchema;
  service = {
    protoPath: path.resolve(__dirname, 'router.proto'),
    protoDescription: 'router.Router',
    functions: {
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
    this._internalRouter = new ConduitRoutingController(
      this.getHttpPort()!,
      '',
      {} as any,
    );
    this._internalRouter.initGraphQL();
    this._internalRouter.initSockets();
    this._security = new SecurityModule(this.grpcSdk, this);
  }

  async onServerStart() {
    this.database = this.grpcSdk.databaseProvider!;
    await runMigrations(this.grpcSdk);
  }

  async onRegister() {
    // this.grpcSdk.bus!.subscribe('email:status:onConfig', () => {
    //   this.onConfig()
    //     .then(() => {
    //       console.log('Updated authentication configuration');
    //     })
    //     .catch(() => {
    //       console.log('Failed to update authentication config');
    //     });
    // });
  }

  protected registerSchemas() {
    // @ts-ignore
    const promises = Object.values(models).map(model => {
      const modelInstance = model.getInstance(this.grpcSdk.database!);
      return this.grpcSdk.database!.createSchemaFromAdapter(modelInstance);
    });
    return Promise.all(promises);
  }

  async onConfig() {
    if (!ConfigController.getInstance().config.active) {
      this.updateHealth(HealthCheckStatus.NOT_SERVING);
    } else {
      await this.updateConfig();
      this.adminRouter = new AdminHandlers(this.grpcServer, this.grpcSdk, this);
      this.updateHealth(HealthCheckStatus.SERVING);
    }
  }

  getHttpPort() {
    const value = (process.env['PORT'] || process.env['CLIENT_PORT']) ?? '3000';
    const port = parseInt(value, 10);
    if (isNaN(port)) {
      console.error(`Invalid HTTP port value: ${port}`);
      process.exit(-1);
    }
    if (port >= 0) {
      return port;
    }
  }

  // async initialize(server: GrpcServer) {
  //   await server.addService(
  //     path.resolve(__dirname, '../../core/src/core.proto'),
  //     'conduit.core.Router',
  //     {
  //       registerConduitRoute: this.registerGrpcRoute.bind(this),
  //       socketPush: this.socketPush.bind(this),
  //     },
  //   );
  //   this.registerAdminRoutes();
  //   this.highAvailability().catch(() => {
  //     console.log('Failed to recover state');
  //   });
  // }

  async highAvailability() {
    const r = await this.grpcSdk.state!.getKey('router');
    if (!r || r.length === 0) return;
    const state = JSON.parse(r);
    if (state.routes) {
      state.routes.forEach((r: any) => {
        try {
          this.internalRegisterRoute(r.protofile, r.routes, r.url);
        } catch (err) {
          console.error(err);
        }
      });
      console.log('Recovered routes');
    }

    this.grpcSdk.bus!.subscribe('router', (message: string) => {
      const messageParsed = JSON.parse(message);
      try {
        this.internalRegisterRoute(
          messageParsed.protofile,
          messageParsed.routes,
          messageParsed.url,
        );
      } catch (err) {
        console.error(err);
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
        console.log('Updated state');
      })
      .catch(() => {
        console.log('Failed to update state');
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
      console.error(err);
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
    const processedRoutes: (
      | ConduitRoute
      | ConduitMiddleware
      | ConduitSocket
    )[] = grpcToConduitRoute(
      'Router',
      {
        protoFile: protofile,
        routes: routes,
        routerUrl: url,
      },
      moduleName,
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
      console.error(err);
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
