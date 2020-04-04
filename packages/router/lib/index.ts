import {Application, NextFunction, Router, Request, Response} from "express";
import {RouteBuilder} from "./builders/RouteBuilder";
import {RouterBuilder} from "./builders/RouterBuilder";

export class ConduitRouter {

    private static _instance: ConduitRouter;
    private _app: Application;
    private _globalMiddlewares: string[];
    private _routes: any[];

    private constructor(app: Application) {
        this._app = app;
        this._routes = [];
        this._globalMiddlewares = [];
    }

    static getInstance(app: Application) {
        if (!this._instance && app) {
            this._instance = new ConduitRouter(app);
            return this._instance;
        } else if (this._instance) {
            return this._instance
        } else {
            throw new Error("No settings provided to initialize");
        }
    }

    registerGlobalMiddleware(name: string, middleware: any) {
        this._globalMiddlewares.push(name);
        this._app.use(middleware);
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
        this._app.use(name, router);
    }

    registerExpressRouter(name: string, router: Router) {
        this._routes.push(name);
        this._app.use(name, router);
    }

    registerDirectRouter(name: string, router: (req: Request, res: Response, next: NextFunction) => void) {
        this._routes.push(name);
        this._app.use(name, router);
    }

    getRegisteredRoutes() {
        return this._routes;
    }


}


export let route = RouteBuilder;
export let router = RouterBuilder;



