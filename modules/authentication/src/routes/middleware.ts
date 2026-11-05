import {
  Cookies,
  GrpcError,
  Headers,
  Indexable,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { AccessTokenVerifier, ConfigController } from '@conduitplatform/module-tools';
import { AuthUtils } from '../utils/index.js';
import { AccessToken, Client, User } from '../models/index.js';
import { isNil } from 'lodash-es';
import { status } from '@grpc/grpc-js';
import { JwtPayload } from 'jsonwebtoken';
import { realmsEnabled } from '../utils/realm.js';
import { authenticateJwt, JwtAuthenticationDeps } from './jwtAuthentication.logic.js';
import { getConfiguredSdk, getSessionRegistry } from '../utils/sessionServices.js';
import { resolveUserById } from '../utils/userResolver.js';
import getToken = AuthUtils.getToken;

/*
 * Expects access token in 'Authorization' header or 'accessToken' cookie
 *
 * Exception: routes using `refreshAuthMiddleware` (/renew, /renew/extend)
 * Expect the refresh token in 'Authorization' header or 'refreshToken' cookie
 *
 * Headers are bearer-formatted (eg: 'Bearer your-token-str')
 */

export async function authMiddleware(
  call: ParsedRouterRequest,
): Promise<UnparsedRouterResponse> {
  const context = call.request.context;
  const headers = call.request.headers;
  const cookies = call.request.cookies;

  return handleAuthentication(context, headers, cookies, call.request.path);
}

export async function refreshAuthMiddleware(
  call: ParsedRouterRequest,
): Promise<UnparsedRouterResponse> {
  return handleTokenRefresh(
    call.request.context,
    call.request.headers,
    call.request.cookies,
  );
}

/** The collaborators of the jwt branch: this module's own verifier, registry and users. */
export function defaultJwtAuthenticationDeps(): JwtAuthenticationDeps {
  return {
    verifier: AccessTokenVerifier.getInstance(getConfiguredSdk()),
    registry: {
      exists: async sid => {
        const registry = getSessionRegistry();
        if (!registry) throw new Error('Session registry unavailable');
        return registry.exists(sid);
      },
    },
    resolveUser: resolveUserById,
    realmsEnabled,
  };
}

export async function handleAuthentication(
  context: Indexable,
  headers: Headers,
  cookies: Cookies,
  path: string,
  jwtDeps?: JwtAuthenticationDeps,
) {
  const token = getToken(headers, cookies, 'access');
  if (ConfigController.getInstance().config.accessTokens.mode === 'jwt') {
    return authenticateJwt(jwtDeps ?? defaultJwtAuthenticationDeps(), {
      token,
      clientId: context.clientId,
      path,
    });
  }
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
    { populate: ['user'], readPreference: 'primary' },
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
  return {
    user: accessToken.user,
    jwtPayload: payload,
    // realm the session is in (team id), null for global sessions and with the flag off
    realm: realmsEnabled() && accessToken.realm ? String(accessToken.realm) : null,
    // the session (refresh token) this access token belongs to, when linked
    sessionId: accessToken.session ? String(accessToken.session) : undefined,
  };
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

export async function checkAnonymousMiddleware(call: ParsedRouterRequest) {
  const { user } = call.request.context;
  if (!user || !user.isAnonymous) {
    return {};
  }
  const config = ConfigController.getInstance().config;
  if (!config.anonymousUsers.enabled)
    throw new Error('Anonymous users configuration is disabled.');
  return { anonymousUser: user };
}

export async function denyAnonymousMiddleware(call: ParsedRouterRequest) {
  const { user } = call.request.context;
  if (user.isAnonymous) {
    throw new GrpcError(
      status.PERMISSION_DENIED,
      'Anonymous users are not allowed to perform this action.',
    );
  }
  return {};
}
