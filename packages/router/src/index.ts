import { Application, NextFunction, Request, Response, Router } from 'express';
import { RouterBuilder } from './builders';
import { ConduitRoutingController } from './controllers/Routing';
import {
  ConduitCommons,
  ConduitMiddleware,
  ConduitRoute,
  ConduitSocket,
  grpcToConduitRoute,
  IConduitRouter,
} from '@conduitplatform/commons';
import { status } from '@grpc/grpc-js';
import ConduitGrpcSdk, { GrpcServer } from '@conduitplatform/grpc-sdk';
import { SocketPush } from './models/SocketPush.model';
import * as adminRoutes from './admin/routes';
import path from 'path';

export class ConduitDefaultRouter implements IConduitRouter {
  grpcSdk: ConduitGrpcSdk;
  private readonly _commons: ConduitCommons;
  private readonly _expressApp: Application;
  private _internalRouter: ConduitRoutingController;
  private readonly _globalMiddlewares: string[];
  private readonly _routes: any[];
  private _grpcRoutes: { [field: string]: ConduitRoute[] } = {};
  private _sdkRoutes: { path: string; action: string }[] = [];

  constructor(
    commons: ConduitCommons,
    grpcSdk: ConduitGrpcSdk,
    expressApp: Application
  ) {
    this._commons = commons;
    this._expressApp = expressApp;
    this._routes = [];
    this._globalMiddlewares = [];
    this._internalRouter = new ConduitRoutingController(this._commons, this._expressApp);
    this.initGraphQL();
    this.initSockets();
    this.grpcSdk = grpcSdk;
  }

  async initialize(server: GrpcServer) {
    await server.addService(
      path.resolve(__dirname, '../../core/src/core.proto'),
      'conduit.core.Router',
      {
        registerConduitRoute: this.registerGrpcRoute.bind(this),
        socketPush: this.socketPush.bind(this),
      },
    );
    this.registerAdminRoutes();
    this.highAvailability().catch(() => {
      console.log('Failed to recover state');
    });
  }

  async highAvailability() {
    let sdk: ConduitCommons = this._commons
    let r = await sdk.getState().getKey('router');
    if (!r || r.length === 0) return;
    let state = JSON.parse(r);
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

    sdk.getBus().subscribe('router', (message: string) => {
      let messageParsed = JSON.parse(message);
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

  updateState(protofile: string, routes: ConduitRoute[], url: string) {
    let sdk: ConduitCommons = this._commons
    sdk
      .getState()
      .getKey('router')
      .then((r: any) => {
        let state = !r || r.length === 0 ? {} : JSON.parse(r);
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
        return sdk.getState().setKey('router', JSON.stringify(state));
      })
      .then(() => {
        this.publishAdminRouteData(protofile, routes, url);
        console.log('Updated state');
      })
      .catch(() => {
        console.log('Failed to update state');
      });
  }

  publishAdminRouteData(protofile: string, routes: ConduitRoute[], url: string) {
    let sdk: ConduitCommons = this._commons
    sdk.getBus().publish(
      'router',
      JSON.stringify({
        protofile,
        routes,
        url,
      }),
    );
  }

  async registerGrpcRoute(call: any, callback: any) {
    const moduleName = call.metadata.get('module-name')[0];
    try {
      if (!call.request.routerUrl) {
        let result = this._commons
          .getConfigManager()!
          .getModuleUrlByName((call as any).metadata.get('module-name')[0]);
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
        moduleName,
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
    callback(null, null);
  }

  internalRegisterRoute(protofile: any, routes: ConduitRoute[], url: string, moduleName?: string) {
    let processedRoutes: (
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

    processedRoutes.forEach((r) => {
      if (r instanceof ConduitMiddleware) {
        console.log(
          'New middleware registered: ' + r.input.path + ' handler url: ' + url,
        );
        this.registerRouteMiddleware(r);
      } else if (r instanceof ConduitSocket) {
        console.log('New socket registered: ' + r.input.path + ' handler url: ' + url);
        this.registerSocket(r);
      } else {
        console.log(
          'New route registered: ' +
          r.input.action +
          ' ' +
          r.input.path +
          ' handler url: ' +
          url,
        );
        this._registerRoute(r);
      }
    });
    this._grpcRoutes[url] = routes;
    this.cleanupRoutes();
  }

  async socketPush(call: any, callback: any) {
    try {
      let socketData: SocketPush = {
        event: call.request.event,
        data: JSON.parse(call.request.data),
        receivers: call.request.receivers,
        rooms: call.request.rooms,
        namespace: `/${(call as any).metadata.get('module-name')[0]}/`
      };
      await this._internalRouter.socketPush(socketData);
    } catch (err) {
      console.error(err);
      return callback({ code: status.INTERNAL, message: 'Well that failed :/' });
    }

    //todo definitely missing an error handler here
    //perhaps wrong(?) we send an empty response
    callback(null, null);
  }

  cleanupRoutes() {
    const routes: { action: string; path: string }[] = [];
    Object.keys(this._grpcRoutes).forEach((grpcRoute: string) => {
      let routesArray = this._grpcRoutes[grpcRoute];
      routes.push(
        ...routesArray.map((route: any) => {
          return { action: route.options.action, path: route.options.path };
        }),
      );
    });

    routes.push(...this._sdkRoutes);

    this._internalRouter.cleanupRoutes(routes);
  }

  initGraphQL() {
    this._internalRouter.initGraphQL();
  }

  initSockets() {
    this._internalRouter.initSockets();
  }

  registerGlobalMiddleware(
    name: string,
    middleware: any,
    socketMiddleware: boolean = false,
  ) {
    this._globalMiddlewares.push(name);
    this._internalRouter.registerMiddleware(middleware, socketMiddleware);
  }

  getGlobalMiddlewares(): string[] {
    return this._globalMiddlewares;
  }

  hasGlobalMiddleware(name: string): boolean {
    return this._globalMiddlewares.indexOf(name) !== -1;
  }

  registerRouter(routerBuilder: RouterBuilder) {
    let { name, router } = routerBuilder.construct();
    this._routes.push(name);
    this._internalRouter.registerRoute(name, router);
  }

  registerExpressRouter(
    name: string,
    router: Router | ((req: Request, res: Response, next: NextFunction) => void),
  ) {
    this._routes.push(name);
    this._internalRouter.registerRoute(name, router);
  }

  registerDirectRouter(
    name: string,
    router: (req: Request, res: Response, next: NextFunction) => void,
  ) {
    this._routes.push(name);
    this._internalRouter.registerRoute(name, router);
  }

  getRegisteredRoutes() {
    return this._routes;
  }

  getGrpcRoutes() {
    return this._grpcRoutes;
  }

  registerRoute(route: ConduitRoute): void {
    this._sdkRoutes.push({ action: route.input.action, path: route.input.path });
    this._registerRoute(route);
  }

  _registerRoute(route: ConduitRoute): void {
    this._internalRouter.registerConduitRoute(route);
  }

  registerRouteMiddleware(middleware: ConduitMiddleware): void {
    this._internalRouter.registerRouteMiddleware(middleware);
  }

  registerSocket(socket: ConduitSocket): void {
    this._internalRouter.registerConduitSocket(socket);
  }

  private registerAdminRoutes() {
    this._commons.getAdmin().registerRoute(adminRoutes.getRoutes(this));
    this._commons.getAdmin().registerRoute(adminRoutes.getMiddlewares(this));
    this._commons.getAdmin().registerRoute(adminRoutes.generateRestClient(this));
    this._commons.getAdmin().registerRoute(adminRoutes.generateGraphQlClient(this));
  }

  setConfig(moduleConfig: any) {
    this._commons.getBus().publish('config:update:router', JSON.stringify(moduleConfig));
  }
}

export * from './builders';
export * from './controllers/Rest';
