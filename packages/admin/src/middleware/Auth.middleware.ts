import { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../utils/auth';
import { isNil } from 'lodash';
import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import { ConduitCommons } from '@quintessential-sft/conduit-commons';

export function getAuthMiddleware(grpcSdk: ConduitGrpcSdk, conduit: ConduitCommons) {
  return async function authMiddleware(req: Request, res: Response, next: NextFunction) {
    if (
      req.originalUrl.indexOf('/admin/login') === 0 ||
      req.originalUrl.indexOf('/admin/modules') === 0
    ) {
      return next();
    }
    const databaseAdapter = await grpcSdk.databaseProvider!;
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
    if (prefix !== 'JWT') {
      return res
        .status(401)
        .json({ error: 'The authorization header must begin with JWT' });
    }
    let decoded;
    try {
      decoded = verifyToken(token, adminConfig.auth.tokenSecret);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    const { id } = decoded;

    databaseAdapter
      .findOne('Admin', { _id: id })
      .then((admin: any) => {
        if (isNil(admin)) {
          return res.status(401).json({ error: 'No such user exists' });
        }
        (req as any).admin = admin;
        next();
      })
      .catch((error: Error) => {
        console.log(error);
        res.status(500).json({ error: 'Something went wrong' });
      });
  };
}
