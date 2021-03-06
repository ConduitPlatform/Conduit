import { NextFunction, Response } from 'express';
import { isNil } from 'lodash';
import ConduitGrpcSdk, { ConfigController } from '@conduitplatform/grpc-sdk';
import { ConduitCommons } from '@conduitplatform/commons';
import { Admin } from '../models';
import { verifyToken } from '../utils/auth';
import { isDev } from '../utils/middleware';
import { ConduitRequest } from '@conduitplatform/hermes';

export function getAuthMiddleware(grpcSdk: ConduitGrpcSdk, conduit: ConduitCommons) {
  return async function authMiddleware(
    req: ConduitRequest,
    res: Response,
    next: NextFunction,
  ) {
    const graphQlCheck =
      req.originalUrl.indexOf('/graphql') === 0 && req.method === 'GET';
    if (
      // Excluded routes
      req.originalUrl.indexOf('/login') === 0 ||
      req.originalUrl.indexOf('/modules') === 0 ||
      ((req.originalUrl.indexOf('/swagger') === 0 || graphQlCheck) &&
        (await isDev(conduit)))
    ) {
      return next();
    }
    const adminConfig = ConfigController.getInstance().config;

    const tokenHeader = req.headers.authorization;
    if (isNil(tokenHeader)) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const args = tokenHeader.split(' ');
    if (args.length !== 2) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const [prefix, token] = args;
    if (prefix !== 'Bearer' && prefix !== 'JWT') {
      // Compat (<=0.12.2): JWT
      return res
        .status(401)
        .json({ error: "The Authorization header must be prefixed by 'Bearer '" });
    }
    let decoded;
    try {
      decoded = verifyToken(token, adminConfig.auth.tokenSecret);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    const { id } = decoded;

    Admin.getInstance()
      .findOne({ _id: id })
      .then((admin: any) => {
        if (isNil(admin)) {
          return res.status(401).json({ error: 'No such user exists' });
        }
        req.conduit!.admin = admin;
        next();
      })
      .catch((error: Error) => {
        ConduitGrpcSdk.Logger.error(error);
        res.status(500).json({ error: 'Something went wrong' });
      });
  };
}
