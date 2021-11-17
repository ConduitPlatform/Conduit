import { Request, Response, NextFunction } from 'express';
import { ConduitCommons, ConduitRoute } from '../../index';

export abstract class IConduitAdmin {
  constructor(conduit: ConduitCommons) {}

  abstract initialize(): void;

  abstract registerRoute(route: ConduitRoute): void;
}
