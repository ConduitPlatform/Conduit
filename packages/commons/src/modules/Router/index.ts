import ConduitGrpcSdk, { GrpcServer } from '@conduitplatform/grpc-sdk';
import { NextFunction, Router, Request, Response, Application } from 'express';
import { ConduitRouterBuilder } from './index';
import { ConduitCommons } from '../..';
import { ConduitMiddleware } from '../../interfaces';
import { ConduitRoute } from '../../classes/ConduitRoute';

export abstract class IConduitRouter {

  protected constructor(protected readonly commons: ConduitCommons,
                        protected readonly grpcSdk: ConduitGrpcSdk,
                        protected readonly expressApp: Application) {
  }

  abstract initialize(server: GrpcServer): Promise<void>;

  abstract registerGlobalMiddleware(name: string, middleware: any, socketMiddleware?: boolean): void;

  abstract registerRouteMiddleware(middleware: ConduitMiddleware): void;

  abstract getGlobalMiddlewares(): string[];

  abstract hasGlobalMiddleware(name: string): boolean;

  abstract registerRouter(routerBuilder: ConduitRouterBuilder): void;

  abstract registerRoute(route: ConduitRoute): void;

  abstract registerExpressRouter(name: string, router: Router | ((req: Request, res: Response, next: NextFunction) => void)): void;

  abstract registerDirectRouter(
    name: string,
    router: (req: Request, res: Response, next: NextFunction) => void,
  ): void;

  abstract getRegisteredRoutes(): any;

  abstract setConfig(moduleConfig: any): void;
}

export * from './classes';
