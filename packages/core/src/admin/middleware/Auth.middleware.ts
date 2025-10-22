import { NextFunction, Response } from 'express';
import { isNil } from 'lodash-es';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
// Removed ConduitCommons import - now using configManager directly
import { Admin } from '../../models/index.js';
import { verifyToken } from '../utils/auth.js';
import { isDev } from '../utils/middleware.js';
import { ConduitRequest } from '@conduitplatform/hermes';
import { gql } from 'graphql-tag';
import { ConfigController } from '@conduitplatform/module-tools';

const excludedRestRoutes = ['/ready', '/login', '/config/modules'];
const excludedGqlOperations = [
  '__schema',
  'IntrospectionQuery',
  'getReady',
  'postLogin',
  'getConfigModules',
];

async function requestExcluded(req: ConduitRequest, configManager: any) {
  if (await isDev(configManager)) {
    if (req.originalUrl.indexOf('/graphql') === 0 && req.method === 'GET') return true;
    if (req.originalUrl.indexOf('/swagger') === 0) return true;
    if (req.originalUrl.indexOf('/reference') === 0) return true;
  }
  // REST
  if (excludedRestRoutes.includes(req.path)) return true;
  // GraphQL
  if (
    req.originalUrl.startsWith('/graphql') &&
    req.body.query &&
    typeof req.body.query === 'string'
  ) {
    const operations: string[] = gql(
      req.body.query,
      // @ts-ignore
    ).definitions[0].selectionSet.selections.map(sel => sel.name.value);
    return !operations.some(op => !excludedGqlOperations.includes(op));
  }
  return false;
}

export function getAuthMiddleware(grpcSdk: ConduitGrpcSdk, configManager: any) {
  return async function authMiddleware(
    req: ConduitRequest,
    res: Response,
    next: NextFunction,
  ) {
    if (await requestExcluded(req, configManager)) return next();
    const adminConfig = ConfigController.getInstance().config;

    const tokenHeader = req.headers.authorization;
    if (isNil(tokenHeader)) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const args = tokenHeader.split(' ');
    if (args.length !== 2) {
      return res.status(401).json({ error: 'Authorization header malformed' });
    }

    const [prefix, token] = args;
    if (prefix !== 'Bearer') {
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
    if (decoded.twoFaRequired && req.path !== '/verify-twofa') {
      return res.status(401).json({ error: 'Two FA required' });
    }

    Admin.getInstance()
      .findOne({ _id: id })
      .then(admin => {
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
