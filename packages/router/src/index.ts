import { Application, NextFunction, Router, Request, Response } from "express";
import { RouterBuilder } from "./builders";
import { ConduitRoutingController } from "./controllers/Routing";
import { ConduitRoute, IConduitRouter, ConduitMiddleware, ConduitSDK } from "@quintessential-sft/conduit-sdk";
import * as grpc from "grpc";
import ConduitGrpcSdk from "@quintessential-sft/conduit-grpc-sdk";

import { grpcToConduitRoute } from "./utils/GrpcConverter";

export class ConduitDefaultRouter implements IConduitRouter {
  private _app: Application;
  private _internalRouter: ConduitRoutingController;
  private _globalMiddlewares: string[];
  private _routes: any[];
  private _grpcRoutes: any = {};
  grpcSdk: ConduitGrpcSdk;

  constructor(app: Application, grpcSdk: ConduitGrpcSdk, packageDefinition: any, server: grpc.Server) {
    this._app = app;
    this._routes = [];
    this._globalMiddlewares = [];
    this._internalRouter = new ConduitRoutingController(this._app);
    this.initGraphQL();
    var protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    this.grpcSdk = grpcSdk;
    // @ts-ignore
    var router = protoDescriptor.conduit.core.Router;
    server.addService(router.service, {
      registerConduitRoute: this.registerGrpcRoute.bind(this),
    });
    this.highAvailability();
  }

  highAvailability() {
    const self = this;
    let sdk: ConduitSDK = (this._app as any).conduit;
    sdk
      .getState()
      .getKey("router")
      .then((r) => {
        if (!r || r.length === 0) return;
        let state = JSON.parse(r);
        if (state.routes) {
          state.routes.forEach((r: any) => {
            try {
              let routes: (ConduitRoute | ConduitMiddleware)[] = grpcToConduitRoute({
                protoFile: r.protofile,
                routes: r.routes,
                routerUrl: r.url,
              });
              this._grpcRoutes[r.url] = r.routes;
              routes.forEach((r) => {
                if (r instanceof ConduitMiddleware) {
                  this.registerRouteMiddleware(r);
                } else {
                  this.registerRoute(r);
                }
              });
            } catch (err) {
              console.error(err);
            }
          });
        }
      })
      .catch((err) => {
        console.log("Failed to recover state");
      });

    sdk.getBus().subscribe("router", (message: string) => {
      try {
        let messageParsed = JSON.parse(message);
        let routes: (ConduitRoute | ConduitMiddleware)[] = grpcToConduitRoute({
          protoFile: messageParsed.protofile,
          routes: messageParsed.routes,
          routerUrl: messageParsed.url,
        });
        this._grpcRoutes[messageParsed.url] = messageParsed.routes;
        routes.forEach((r) => {
          if (r instanceof ConduitMiddleware) {
            this.registerRouteMiddleware(r);
          } else {
            this.registerRoute(r);
          }
        });
        this.cleanupRoutes();
      } catch (err) {
        console.error(err);
      }
    });
  }

  updateState(protofile: string, routes: any, url: string) {
    let sdk: ConduitSDK = (this._app as any).conduit;
    sdk
      .getState()
      .getKey("router")
      .then((r) => {
        let state = !r || r.length === 0 ? {} : JSON.parse(r);
        if (!state.routes) state.routes = [];
        state.routes.push({
          protofile,
          routes,
          url,
        });
        return sdk.getState().setKey("router", JSON.stringify(state));
      })
      .then((r) => {
        console.log("Updated state");
      })
      .catch((err) => {
        console.log("Failed to recover state");
      });
  }

  publishAdminRouteData(protofile: string, routes: any, url: string) {
    let sdk: ConduitSDK = (this._app as any).conduit;
    sdk.getBus().publish(
      "router",
      JSON.stringify({
        protofile,
        routes,
        url,
      })
    );
  }

  registerGrpcRoute(call: any, callback: any) {
    try {
      let routes: (ConduitRoute | ConduitMiddleware)[] = grpcToConduitRoute(call.request);
      routes.forEach((r) => {
        if (r instanceof ConduitMiddleware) {
          this.registerRouteMiddleware(r);
        } else {
          this.registerRoute(r);
        }
      });
      this._grpcRoutes[call.request.routerUrl] = call.request.routes;
      this.cleanupRoutes();
      this.publishAdminRouteData(call.request.protoFile, call.request.routes, call.request.routerUrl);
      this.updateState(call.request.protoFile, call.request.routes, call.request.routerUrl);
    } catch (err) {
      console.error(err);
      return callback({ code: grpc.status.INTERNAL, message: "Well that failed :/" });
    }

    //todo definitely missing an error handler here
    //perhaps wrong(?) we send an empty response
    callback(null, null);
  }

  cleanupRoutes(){
    let routes: {action: string, path:string}[] = [];
     Object.keys(this._grpcRoutes)
     .forEach((grpcRoute:string)=>{
      let routesArray = this._grpcRoutes[grpcRoute];
      routes.push(...routesArray.map((route:any)=>{return {action: route.options.action, path: route.options.path}}));
     })
    this._internalRouter.cleanupRoutes;
  }

  initGraphQL() {
    this._internalRouter.initGraphQL();
  }

  registerGlobalMiddleware(name: string, middleware: any) {
    this._globalMiddlewares.push(name);
    this._internalRouter.registerMiddleware(middleware);
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

  registerExpressRouter(name: string, router: Router) {
    this._routes.push(name);
    this._internalRouter.registerRoute(name, router);
  }

  registerDirectRouter(name: string, router: (req: Request, res: Response, next: NextFunction) => void) {
    this._routes.push(name);
    this._internalRouter.registerRoute(name, router);
  }

  getRegisteredRoutes() {
    return this._routes;
  }

  registerRoute(route: ConduitRoute): void {
    this._internalRouter.registerConduitRoute(route);
  }

  registerRouteMiddleware(middleware: ConduitMiddleware): void {
    this._internalRouter.registerRouteMiddleware(middleware);
  }
}

export * from "./builders";
