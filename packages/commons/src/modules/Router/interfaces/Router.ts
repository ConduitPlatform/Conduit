import { NextFunction, Router, Request, Response } from 'express';
import { ConduitRouterBuilder } from '../classes';
import {
  ConduitMiddleware,
  ConduitRoute,
} from '../../../interfaces';

export interface IConduitRouter {
  registerGlobalMiddleware(name: string, middleware: any, socketMiddleware?: boolean): void;

  registerRouteMiddleware(middleware: ConduitMiddleware): void;

  getGlobalMiddlewares(): string[];

  hasGlobalMiddleware(name: string): boolean;

  registerRouter(routerBuilder: ConduitRouterBuilder): void;

  registerRoute(route: ConduitRoute): void;

  registerExpressRouter(name: string, router: Router | ((req: Request, res: Response, next: NextFunction) => void)): void;

  registerDirectRouter(
    name: string,
    router: (req: Request, res: Response, next: NextFunction) => void
  ): void;

  getRegisteredRoutes(): any;

  setConfig(moduleConfig: any): void;
}
