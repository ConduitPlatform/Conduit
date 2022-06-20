import { NextFunction, Response } from 'express';
import { isNil } from 'lodash';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
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
    if (
      // Excluded routes
      req.originalUrl.indexOf('/admin/login') === 0 ||
      req.originalUrl.indexOf('/admin/modules') === 0 ||
      (req.originalUrl.indexOf('/admin/swagger') === 0 && (await isDev(conduit)))
    ) {
      return next();
    }
    const adminConfig = await conduit.getConfigManager().get('admin');

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
