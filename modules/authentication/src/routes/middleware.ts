import {
  Cookies,
  GrpcError,
  Headers,
  Indexable,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { AuthUtils } from '../utils/index.js';
import { AccessToken, Client, User } from '../models/index.js';
import { isNil } from 'lodash-es';
import { status } from '@grpc/grpc-js';
import { JwtPayload } from 'jsonwebtoken';
import moment from 'moment';
import getToken = AuthUtils.getToken;

/*
 * Expects access token in 'Authorization' header or 'accessToken' cookie
 *
 * Exception: '/authentication/renew' (token renewal)
 * Expects refresh token in 'Authorization' header or 'refreshToken' cookie
 *
 * Headers are bearer-formatted (eg: 'Bearer your-token-str')
 */

export async function authMiddleware(
  call: ParsedRouterRequest,
): Promise<UnparsedRouterResponse> {
  const context = call.request.context;
  const headers = call.request.headers;
  const cookies = call.request.cookies;

  if (call.request.path === '/authentication/renew') {
    return handleTokenRefresh(context, headers, cookies);
  }

  return handleAuthentication(context, headers, cookies, call.request.path);
}

export async function handleAuthentication(
  context: Indexable,
  headers: Headers,
  cookies: Cookies,
  path: string,
) {
  const token = getToken(headers, cookies, 'access');
  const payload: string | JwtPayload | null = AuthUtils.verify(
    token,
    ConfigController.getInstance().config.accessTokens.jwtSecret,
  );
  if (!payload || typeof payload === 'string') {
    throw new GrpcError(
      status.UNAUTHENTICATED,
      'Token is expired or otherwise not valid',
    );
  }
  // delete all expired tokens
  AccessToken.getInstance()
    .deleteMany({
      expiresOn: { $lte: moment.utc().toDate() },
    })
    .catch();

  if (
    !(payload as JwtPayload).authorized &&
    path !== '/authentication/twoFa/verify' &&
    path !== '/authentication/twoFa/authorize' &&
    path !== '/authentication/twoFa/recover'
  ) {
    throw new GrpcError(status.UNAUTHENTICATED, '2FA is required');
  }
  const accessToken = await AccessToken.getInstance().findOne(
    {
      token,
      clientId: context.clientId,
    },
    undefined,
    ['user'],
  );
  if (!accessToken) {
    throw new GrpcError(
      status.UNAUTHENTICATED,
      'Token has been revoked or there is a mismatch between the token and the client',
    );
  }
  if (!accessToken.user || !(accessToken.user as User).active) {
    throw new GrpcError(status.PERMISSION_DENIED, 'User is blocked or deleted');
  }
  return { user: accessToken.user, jwtPayload: payload };
}

function handleTokenRefresh(context: Indexable, headers: Headers, cookies: Cookies) {
  const token = getToken(headers, cookies, 'refresh');
  return { refreshToken: token };
}

export async function captchaMiddleware(call: ParsedRouterRequest) {
  const { acceptablePlatform, enabled } = ConfigController.getInstance().config.captcha;
  const { clientId, captcha } = call.request.context;

  let clientPlatform;

  if (!enabled || captcha === 'disabled') {
    throw new GrpcError(status.INTERNAL, 'Captcha is disabled.');
  }

  if (clientId === 'anonymous-client') clientPlatform = 'anonymous-client';
  const client = await Client.getInstance().findOne({ clientId: clientId });
  if (!isNil(client)) clientPlatform = client!.platform;

  switch (clientPlatform) {
    case 'WEB':
    case 'ANDROID':
      if (!acceptablePlatform[clientPlatform.toLowerCase()]) {
        break;
      }
      if (captcha === 'missing') {
        throw new GrpcError(status.INTERNAL, `Captcha token is missing.`);
      }
      if (captcha === 'failed') {
        throw new GrpcError(status.PERMISSION_DENIED, 'Can not verify captcha.');
      }
      break;
    case 'anonymous-client':
      if (captcha === 'failed') {
        throw new GrpcError(status.PERMISSION_DENIED, 'Can not verify captcha.');
      }
      break;
  }

  return {};
}

export async function authAnonymousMiddleware(call: ParsedRouterRequest) {
  const context = call.request.context;
  const headers = call.request.headers;
  const cookies = call.request.cookies;
  let authError;
  const { user, jwtPayload } = await handleAuthentication(
    context,
    headers,
    cookies,
    call.request.path,
  ).catch(e => (authError = e));
  const config = ConfigController.getInstance().config;
  if (user.isAnonymous) {
    if (authError) throw authError;
    if (!config.anonymousUsers.enabled)
      throw new Error('Anonymous users configuration is disabled.');
    return { anonymousUser: user, jwtPayload };
  }
}

export async function denyAnonymousMiddleware(call: ParsedRouterRequest) {
  const { user } = call.request.context;
  if (user.isAnonymous) {
    throw new GrpcError(
      status.PERMISSION_DENIED,
      'Anonymous users are not allowed to perform this action.',
    );
  }
}
