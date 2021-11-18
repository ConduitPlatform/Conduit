import { Application, NextFunction, Request, Response, Router } from 'express';
import { RouterBuilder } from './builders';
import { ConduitRoutingController } from './controllers/Routing';
import {
  ConduitCommons,
  ConduitMiddleware,
  ConduitRoute,
  ConduitSocket,
  IConduitRouter,
  grpcToConduitRoute,
} from '@quintessential-sft/conduit-commons';
import { loadPackageDefinition, Server, status } from '@grpc/grpc-js';
import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';

export class ConduitDefaultRouter implements IConduitRouter {
  grpcSdk: ConduitGrpcSdk;
  private _app: Application;
  private _internalRouter: ConduitRoutingController;
  private _globalMiddlewares: string[];
  private _routes: any[];
  private _grpcRoutes: any = {};
  private _sdkRoutes: { path: string; action: string }[] = [];

  constructor(
    app: Application,
    grpcSdk: ConduitGrpcSdk,
    packageDefinition: any,
    server: Server
  ) {
    this._app = app;
    this._routes = [];
    this._globalMiddlewares = [];
    this._internalRouter = new ConduitRoutingController(this._app);
    this.initGraphQL();
    this.initSockets();
    var protoDescriptor = loadPackageDefinition(packageDefinition);
    this.grpcSdk = grpcSdk;
    // @ts-ignore
    var router = protoDescriptor.conduit.core.Router;
    server.addService(router.service, {
      registerConduitRoute: this.registerGrpcRoute.bind(this),
    });
    this.highAvailability().catch(() => {
      console.log('Failed to recover state');
    });
  }

  async highAvailability() {
    let sdk: ConduitCommons = (this._app as any).conduit;
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
          messageParsed.url
        );
      } catch (err) {
        console.error(err);
      }
    });
  }

  updateState(protofile: string, routes: any, url: string) {
    let sdk: ConduitCommons = (this._app as any).conduit;
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

  publishAdminRouteData(protofile: string, routes: any, url: string) {
    let sdk: ConduitCommons = (this._app as any).conduit;
    sdk.getBus().publish(
      'router',
      JSON.stringify({
        protofile,
        routes,
        url,
      })
    );
  }

  async registerGrpcRoute(call: any, callback: any) {
    try {
      let url = call.request.routerUrl;
      let moduleName: string | undefined = undefined;
      if (!url) {
        let result = ((this._app as any).conduit! as ConduitCommons)
          .getConfigManager()!
          .getModuleUrlByInstance(call.getPeer());
        if (!result) {
          return callback({
            code: status.INTERNAL,
            message: 'Error when registering routes',
          });
        }
        call.request.routerUrl = result.url;
        moduleName = result!.moduleName;
      }

      this.internalRegisterRoute(
        call.request.protoFile,
        call.request.routes,
        call.request.routerUrl,
        moduleName
      );
      this.updateState(
        call.request.protoFile,
        call.request.routes,
        call.request.routerUrl
      );
    } catch (err) {
      console.error(err);
      return callback({ code: status.INTERNAL, message: 'Well that failed :/' });
    }

    //todo definitely missing an error handler here
    //perhaps wrong(?) we send an empty response
    callback(null, null);
  }

  internalRegisterRoute(protofile: any, routes: any[], url: any, moduleName?: string) {
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
      moduleName
    );

    processedRoutes.forEach((r) => {
      if (r instanceof ConduitMiddleware) {
        console.log(
          'New middleware registered: ' + r.input.path + ' handler url: ' + url
        );
        this.registerRouteMiddleware(r);
      } else if (r instanceof ConduitSocket) {
        console.log('New socker registered: ' + r.input.path + ' handler url: ' + url);
        this.registerSocket(r);
      } else {
        console.log(
          'New route registered: ' +
            r.input.action +
            ' ' +
            r.input.path +
            ' handler url: ' +
            url
        );
        this._registerRoute(r);
      }
    });
    this._grpcRoutes[url] = routes;
    this.cleanupRoutes();
  }

  cleanupRoutes() {
    let routes: { action: string; path: string }[] = [];
    Object.keys(this._grpcRoutes).forEach((grpcRoute: string) => {
      let routesArray = this._grpcRoutes[grpcRoute];
      routes.push(
        ...routesArray.map((route: any) => {
          return { action: route.options.action, path: route.options.path };
        })
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
    socketMiddleware: boolean = false
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
    router: Router | ((req: Request, res: Response, next: NextFunction) => void)
  ) {
    this._routes.push(name);
    this._internalRouter.registerRoute(name, router);
  }

  registerDirectRouter(
    name: string,
    router: (req: Request, res: Response, next: NextFunction) => void
  ) {
    this._routes.push(name);
    this._internalRouter.registerRoute(name, router);
  }

  getRegisteredRoutes() {
    return this._routes;
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
}

export * from './builders';
