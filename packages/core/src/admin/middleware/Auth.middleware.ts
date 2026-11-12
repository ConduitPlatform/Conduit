import { NextFunction, Response } from 'express';
import { isNil } from 'lodash-es';
import { ConduitGrpcSdk, type FindManyOptions } from '@conduitplatform/grpc-sdk';
import { Admin, AdminApiToken } from '../../models/index.js';
import { verifyToken, comparePasswords } from '../utils/auth.js';
import { isDev } from '../utils/middleware.js';
import { ConduitRequest } from '@conduitplatform/hermes';
import { gql } from 'graphql-tag';
import { ConfigController } from '@conduitplatform/module-tools';
import { realtimeTicketForbiddenOnHttp } from '../realtime/ticket.js';
import { errors } from '../../errors.js';
import { sendError, sendInternalError } from '../utils/errorResponse.js';

const excludedRestRoutes = ['/ready', '/live', '/login', '/config/modules'];
const excludedGqlOperations = [
  '__schema',
  'IntrospectionQuery',
  'getReady',
  'getLive',
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
    const candidates = await AdminApiToken.getInstance().findMany({ tokenPrefix }, {
      select: '+hashedToken',
      readPreference: 'primary',
    } satisfies FindManyOptions);

    for (const candidate of candidates) {
      const isMatch = await comparePasswords(token, candidate.hashedToken);
      if (isMatch) {
        // Check expiration
        if (candidate.expiresAt && new Date(candidate.expiresAt) < new Date()) {
          sendError(res, errors.ADMIN_TOKEN_EXPIRED);
          return;
        }

        // Get the admin user
        const admin = await Admin.getInstance().findOne({ _id: candidate.adminId });
        if (isNil(admin)) {
          sendError(res, errors.ADMIN_TOKEN_OWNER_NOT_FOUND);
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

    sendError(res, errors.ADMIN_TOKEN_INVALID);
  } catch (error) {
    ConduitGrpcSdk.Logger.error(error as Error);
    sendInternalError(res);
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
    sendError(res, errors.ADMIN_TOKEN_INVALID);
    return;
  }

  const { id } = decoded;
  if (realtimeTicketForbiddenOnHttp(decoded, req)) {
    sendError(res, errors.REALTIME_TICKET_NOT_ALLOWED_ON_HTTP);
    return;
  }
  if (decoded.twoFaRequired && req.path !== '/verify-twofa') {
    sendError(res, errors.ADMIN_TWO_FA_REQUIRED);
    return;
  }

  try {
    const admin = await Admin.getInstance().findOne({ _id: id });
    if (isNil(admin)) {
      sendError(res, errors.ADMIN_TOKEN_OWNER_NOT_FOUND);
      return;
    }
    req.conduit!.admin = admin;
    next();
  } catch (error) {
    ConduitGrpcSdk.Logger.error(error as Error);
    sendInternalError(res);
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
      return sendError(res, errors.ADMIN_TOKEN_MISSING);
    }

    const args = tokenHeader.split(' ');
    if (args.length !== 2) {
      return sendError(
        res,
        errors.ADMIN_AUTH_HEADER_MALFORMED,
        'Expected exactly two parts separated by a space',
      );
    }

    const [prefix, token] = args;
    if (prefix !== 'Bearer') {
      return sendError(
        res,
        errors.ADMIN_AUTH_HEADER_MALFORMED,
        "The Authorization header must be prefixed by 'Bearer '",
      );
    }

    // Check if this is an API token (starts with cdt_)
    if (token.startsWith('cdt_')) {
      return handleApiToken(token, req, res, next);
    }

    // Otherwise, treat as JWT
    return handleJwtToken(token, adminConfig, req, res, next);
  };
}
