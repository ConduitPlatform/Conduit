import { NextFunction, Response } from 'express';
import { isNil } from 'lodash-es';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { Admin, AdminApiToken } from '../../models/index.js';
import { verifyToken, comparePasswords } from '../utils/auth.js';
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

/**
 * Handles authentication via API tokens (prefixed with cdt_).
 * These are long-lived tokens created via the /api-tokens endpoint.
 */
async function handleApiToken(
  token: string,
  req: ConduitRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tokenPrefix = token.substring(0, 12);

    // Find tokens matching the prefix
    const candidates = await AdminApiToken.getInstance().findMany(
      { tokenPrefix },
      '+hashedToken',
    );

    for (const candidate of candidates) {
      const isMatch = await comparePasswords(token, candidate.hashedToken);
      if (isMatch) {
        // Check expiration
        if (candidate.expiresAt && new Date(candidate.expiresAt) < new Date()) {
          res.status(401).json({ error: 'Token has expired' });
          return;
        }

        // Get the admin user
        const admin = await Admin.getInstance().findOne({ _id: candidate.adminId });
        if (isNil(admin)) {
          res.status(401).json({ error: 'No such user exists' });
          return;
        }

        // Update lastUsedAt (fire and forget)
        AdminApiToken.getInstance()
          .findByIdAndUpdate(candidate._id, { lastUsedAt: new Date() })
          .catch(() => {});

        req.conduit!.admin = admin;
        next();
        return;
      }
    }

    res.status(401).json({ error: 'Invalid token' });
  } catch (error) {
    ConduitGrpcSdk.Logger.error(error as Error);
    res.status(500).json({ error: 'Something went wrong' });
  }
}

/**
 * Handles authentication via JWT tokens (session tokens from login).
 */
async function handleJwtToken(
  token: string,
  adminConfig: any,
  req: ConduitRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  let decoded;
  try {
    decoded = verifyToken(token, adminConfig.auth.tokenSecret);
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  const { id } = decoded;
  if (decoded.twoFaRequired && req.path !== '/verify-twofa') {
    res.status(401).json({ error: 'Two FA required' });
    return;
  }

  try {
    const admin = await Admin.getInstance().findOne({ _id: id });
    if (isNil(admin)) {
      res.status(401).json({ error: 'No such user exists' });
      return;
    }
    req.conduit!.admin = admin;
    next();
  } catch (error) {
    ConduitGrpcSdk.Logger.error(error as Error);
    res.status(500).json({ error: 'Something went wrong' });
  }
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

    // Check if this is an API token (starts with cdt_)
    if (token.startsWith('cdt_')) {
      return handleApiToken(token, req, res, next);
    }

    // Otherwise, treat as JWT
    return handleJwtToken(token, adminConfig, req, res, next);
  };
}
