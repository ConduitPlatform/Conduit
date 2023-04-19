import {
  Cookies,
  GrpcError,
  Headers,
  Indexable,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { AuthUtils } from '../utils';
import { AccessToken, Client, User } from '../models';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import { JwtPayload } from 'jsonwebtoken';
import moment from 'moment/moment';

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

async function handleAuthentication(
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
    throw new GrpcError(status.UNAUTHENTICATED, 'Invalid token');
  }
  if (moment().isAfter(moment().milliseconds(payload.exp!))) {
    throw new GrpcError(
      status.UNAUTHENTICATED,
      'Token is expired or otherwise not valid',
    );
  }
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
  if (!accessToken || !accessToken.user) {
    throw new GrpcError(
      status.UNAUTHENTICATED,
      'Token is expired or otherwise not valid',
    );
  }
  if (!(accessToken.user as User).active) {
    throw new GrpcError(status.PERMISSION_DENIED, 'User is blocked');
  }
  return { user: accessToken.user, jwtPayload: payload };
}

function handleTokenRefresh(context: Indexable, headers: Headers, cookies: Cookies) {
  const token = getToken(headers, cookies, 'refresh');
  return { refreshToken: token };
}

function getToken(headers: Headers, cookies: Cookies, reqType: 'access' | 'refresh') {
  const tokenHeader = (headers['Authorization'] || headers['authorization']) as string; // formatted token
  const tokenCookie = cookies[`${reqType}Token`] as string; // token
  if (isNil(tokenHeader) && isNil(tokenCookie)) {
    throw new GrpcError(
      status.UNAUTHENTICATED,
      `No 'Authorization' header or '${reqType}Token' cookie present`,
    );
  }
  let headerArgs: string[] = [];
  if (tokenHeader) {
    headerArgs = tokenHeader.split(' ');
    if (headerArgs.length !== 2) {
      throw new GrpcError(status.UNAUTHENTICATED, "'Authorization' header malformed");
    }
    if (headerArgs[0] !== 'Bearer') {
      throw new GrpcError(
        status.UNAUTHENTICATED,
        "The 'Authorization' header must be prefixed by 'Bearer '",
      );
    }
  }
  return headerArgs[1] || tokenCookie;
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
