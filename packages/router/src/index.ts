import {Application, NextFunction, Router, Request, Response} from "express";
import {RouterBuilder} from "./builders";
import {ConduitRoutingController} from "./controllers/Routing";
import {ConduitRoute, IConduitRouter} from "@conduit/sdk";


export class ConduitDefaultRouter implements IConduitRouter {

    private _app: Application;
    private _internalRouter: ConduitRoutingController;
    private _globalMiddlewares: string[];
    private _routes: any[];

    constructor(app: Application) {
        this._app = app;
        this._routes = [];
        this._globalMiddlewares = [];
        this._internalRouter = new ConduitRoutingController(this._app);
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

}


export * from './builders';



