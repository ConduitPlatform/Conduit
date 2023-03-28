import { NextFunction, Response } from 'express';
import { isNil } from 'lodash';
import { ConduitCommons } from '@conduitplatform/commons';
import { isDev } from '../utils/middleware';
import { ConduitRequest } from '@conduitplatform/hermes';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

export function getAdminMiddleware(conduit: ConduitCommons) {
  return async function adminMiddleware(
    req: ConduitRequest,
    res: Response,
    next: NextFunction,
  ) {
    // Excluded routes
    const graphQlCheck =
      req.originalUrl.indexOf('/graphql') === 0 && req.method === 'GET';
    if (
      (req.originalUrl.indexOf('/swagger') === 0 || graphQlCheck) &&
      (await isDev(conduit))
    ) {
      return next();
    }
    if (req.originalUrl.indexOf('/ready') === 0) {
      return next();
    }
    const masterKey = req.headers.masterkey;
    if (
      (!process.env.MASTER_KEY || process.env.MASTER_KEY.length === 0) &&
      (!process.env.masterkey || process.env.masterkey.length === 0)
    ) {
      ConduitGrpcSdk.Logger.warn(
        '!Security issue!: Master key not set, defaulting to insecure string',
      );
    }
    const master = process.env.MASTER_KEY ?? 'M4ST3RK3Y';
    if (isNil(masterKey) || masterKey !== master)
      return res.status(401).json({ error: 'Unauthorized' });
    next();
  };
}
