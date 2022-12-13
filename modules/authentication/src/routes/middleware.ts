import {
  ConfigController,
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
  Indexable,
  Headers,
  Cookies,
  PlatformTypesEnum,
} from '@conduitplatform/grpc-sdk';
import { AuthUtils } from '../utils';
import { AccessToken, Client } from '../models';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import { JwtPayload } from 'jsonwebtoken';
import moment from 'moment/moment';
import axios from 'axios';

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

export async function captchaMiddleware(call: ParsedRouterRequest) {
  const config = ConfigController.getInstance().config;
  if (!config.captcha.enabled) {
    throw new GrpcError(status.INTERNAL, 'Captcha is disabled.');
  }
  const { captcha } = call.request.params;
  const secret = config.captcha.google.secretKey;
  const { clientId } = call.request.context;
  if (clientId === 'anonymous-client') {
    throw new GrpcError(
      status.INTERNAL,
      'Can not apply captcha middleware on anonymous clients. Client validation should be enabled.',
    );
  }

  const client = await Client.getInstance().findOne({ clientId: clientId });
  const platform = client!.platform;

  if (!secret) {
    throw new GrpcError(status.INTERNAL, 'Secret key for recaptcha is required.');
  }
  if (platform != PlatformTypesEnum.WEB && platform != PlatformTypesEnum.ANDROID) {
    throw new GrpcError(
      status.INTERNAL,
      'Google recaptcha v2 supports only WEB and ANDROID clients.',
    );
  }
  const response = await axios.post(
    `https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${captcha}`,
    {},
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
      },
    },
  );
  if (!response.data.success) {
    throw new GrpcError(status.UNAUTHENTICATED, 'Can not verify captcha token');
  }

  return {};
}
