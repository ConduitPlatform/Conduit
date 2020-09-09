import {NextFunction, Router, Request, Response} from "express";
import {ConduitRouterBuilder} from "../classes";
import {ConduitRoute, ConduitRouteParameters} from "../../../interfaces";

export interface IConduitRouter {

    registerGlobalMiddleware(name: string, middleware: any): void

    registerRouteMiddleware(path: string, middleware: (request: ConduitRouteParameters) => Promise<any>): void

    getGlobalMiddlewares(): string[]

    hasGlobalMiddleware(name: string): boolean

    registerRouter(routerBuilder: ConduitRouterBuilder): void

    registerRoute(route: ConduitRoute): void

    registerExpressRouter(name: string, router: Router): void

    registerDirectRouter(name: string, router: (req: Request, res: Response, next: NextFunction) => void): void

    getRegisteredRoutes(): any;
}
