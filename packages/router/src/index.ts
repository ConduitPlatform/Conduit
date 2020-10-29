import {Application, NextFunction, Router, Request, Response} from "express";
import {RouterBuilder} from "./builders";
import {ConduitRoutingController} from "./controllers/Routing";
import {ConduitRoute, IConduitRouter, ConduitMiddleware} from '@quintessential-sft/conduit-sdk';
import * as grpc from "grpc";
import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';

import {grpcToConduitRoute} from './utils/GrpcConverter';

export class ConduitDefaultRouter implements IConduitRouter {

    private _app: Application;
    private _internalRouter: ConduitRoutingController;
    private _globalMiddlewares: string[];
    private _routes: any[];
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
        })
    }

    registerGrpcRoute(call: any, callback: any) {
        try {
            let routes: (ConduitRoute | ConduitMiddleware)[] = grpcToConduitRoute(call.request);
            routes.forEach(r => {
                if (r instanceof ConduitMiddleware) {
                    this.registerRouteMiddleware(r);
                } else {
                    this.registerRoute(r);
                }
            })
        } catch (err) {
            return callback({code: grpc.status.INTERNAL, message: "Well that failed :/"})
        }

        //todo definitely missing an error handler here
        //perhaps wrong(?) we send an empty response
        callback(null, null);
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
        let {name, router} = routerBuilder.construct();
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


export * from './builders';



