import { NextFunction, Response } from 'express';
import { isNil } from 'lodash';
import { gql } from 'apollo-server-core';
import ConduitGrpcSdk, { ConfigController } from '@conduitplatform/grpc-sdk';
import { ConduitCommons } from '@conduitplatform/commons';
import { Admin } from '../models';
import { verifyToken } from '../utils/auth';
import { isDev } from '../utils/middleware';
import { ConduitRequest } from '@conduitplatform/hermes';

const excludedRestRoutes = ['/ready', '/login', '/modules', '/verify-twofa'];
const excludedGqlOperations = [
  '__schema',
  'IntrospectionQuery',
  'getReady',
  'postLogin',
  'getConfigModules',
];

async function requestExcluded(req: ConduitRequest, conduit: ConduitCommons) {
  if (await isDev(conduit)) {
    if (req.originalUrl.indexOf('/graphql') === 0 && req.method === 'GET') return true;
    if (req.originalUrl.indexOf('/swagger') === 0) return true;
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

export function getAuthMiddleware(grpcSdk: ConduitGrpcSdk, conduit: ConduitCommons) {
  return async function authMiddleware(
    req: ConduitRequest,
    res: Response,
    next: NextFunction,
  ) {
    if (await requestExcluded(req, conduit)) return next();
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
