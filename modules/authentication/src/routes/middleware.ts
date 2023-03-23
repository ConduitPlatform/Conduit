import {
  ConfigController,
  Cookies,
  GrpcError,
  Headers,
  Indexable,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { AuthUtils } from '../utils';
import { AccessToken, Client } from '../models';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import { JwtPayload } from 'jsonwebtoken';
import moment from 'moment/moment';
import { verify as hcaptchaVerify } from 'hcaptcha';

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

async function verifyCaptcha(secretKey: string, provider: string, token: string) {
  let success = false;
  if (provider === 'recaptcha') {
    success = await AuthUtils.recaptchaVerify(secretKey, token);
  } else {
    const response = await hcaptchaVerify(secretKey, token);
    success = response.success;
  }
  return success;
}

export async function captchaMiddleware(call: ParsedRouterRequest) {
  const { acceptablePlatform, secretKey, enabled, provider } =
    ConfigController.getInstance().config.captcha;
  const { clientId } = call.request.context;

  let clientPlatform;
  const { captchaToken } = call.request.params;

  if (!enabled) {
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
      if (captchaToken == null) {
        throw new GrpcError(status.INTERNAL, `Captcha token is missing.`);
      }
      if (!secretKey) {
        throw new GrpcError(status.INTERNAL, 'Secret key for recaptcha is required.');
      }
      if (!(await verifyCaptcha(secretKey, provider, captchaToken))) {
        throw new GrpcError(status.INTERNAL, 'Can not verify captcha.');
      }
      break;
    case 'anonymous-client':
      if (captchaToken != null) {
        if (!secretKey) {
          throw new GrpcError(status.INTERNAL, 'Secret key for recaptcha is required.');
        }
        if (!(await verifyCaptcha(secretKey, provider, captchaToken))) {
          throw new GrpcError(status.INTERNAL, 'Can not verify captcha.');
        }
      }
      break;
  }

  return {};
}
