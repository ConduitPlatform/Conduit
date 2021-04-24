import { Handler, NextFunction, Request, Response } from 'express';
import { ConduitCommons } from '../../index';

export abstract class IConduitAdmin {
  constructor(conduit: ConduitCommons) {}

  abstract initialize(): void;

  abstract registerRoute(method: string, route: string, handler: Handler): void;

  abstract authMiddleware(req: Request, res: Response, next: NextFunction): void;

  abstract adminMiddleware(req: Request, res: Response, next: NextFunction): void;
}
