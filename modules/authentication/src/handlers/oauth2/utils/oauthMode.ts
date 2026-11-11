import { GrpcError } from '@conduitplatform/grpc-sdk';
import { authErrors, ConduitString, ModuleError } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { errors } from '../../../errors.js';
import { parseConduitCode } from '../../../utils/common.logic.js';

export const OAUTH_MODES = ['signIn', 'both'] as const;
export type OAuthMode = (typeof OAUTH_MODES)[number];

export const OAUTH_MODE_PARAM = ConduitString.OptionalWith({
  pattern: '^(signIn|both)$',
  message: 'mode must be "signIn" or "both"',
});

export function isOAuthMode(value: unknown): value is OAuthMode {
  return value === 'signIn' || value === 'both';
}

export function resolveOAuthMode(value: unknown): OAuthMode {
  if (value === undefined || value === null || value === '') {
    return 'both';
  }
  if (isOAuthMode(value)) {
    return value;
  }
  throw new ModuleError(errors.OAUTH_MODE_INVALID);
}

export function isOAuthInvitationToken(invitationToken?: string): boolean {
  return typeof invitationToken === 'string' && invitationToken.trim().length > 0;
}

export function assertOAuthRegistrationAllowed(
  mode: OAuthMode,
  invitationToken?: string,
): void {
  switch (mode) {
    case 'both':
      return;
    case 'signIn':
      if (isOAuthInvitationToken(invitationToken)) {
        return;
      }
      throw new ModuleError(errors.REGISTRATION_NOT_ALLOWED);
    default: {
      const _exhaustive: never = mode;
      throw new GrpcError(status.INTERNAL, `Unhandled OAuth mode: ${_exhaustive}`);
    }
  }
}

export function isRegistrationNotAllowedError(err: unknown): boolean {
  return parseConduitCode(err) === errors.REGISTRATION_NOT_ALLOWED.conduitCode;
}

/**
 * Errors an OAuth redirect flow reports to the app as a `conduitCode` query param
 * instead of a raw error page (the browser is mid-redirect and has no API client).
 */
export const OAUTH_REDIRECTABLE_ERRORS = [
  errors.REGISTRATION_NOT_ALLOWED,
  errors.REALM_ACCESS_DENIED,
  errors.ACCOUNT_LINK_AVAILABLE,
  errors.STRATEGY_NOT_AVAILABLE_FOR_REALM,
  errors.GUESTS_NOT_ALLOWED,
  errors.TWO_FA_REQUIRED_FOR_REALM,
  errors.INVALID_INVITATION,
  errors.INVITATION_REQUIRED,
] as const;

/**
 * Errors declared on the OAuth callback and native completion routes: the redirectable
 * ones plus realm resolution, the state, the provider and the user lookup/creation.
 */
export const OAUTH_ROUTE_ERRORS = [
  ...OAUTH_REDIRECTABLE_ERRORS,
  errors.REALM_NOT_FOUND,
  errors.REALMS_DISABLED,
  errors.REALM_SLUG_INVALID,
  errors.STRATEGY_DISABLED,
  errors.OAUTH_STATE_INVALID,
  errors.OAUTH_PROVIDER_AUTH_FAILED,
  errors.OAUTH_PROFILE_INCOMPLETE,
  errors.OAUTH_ACCOUNT_LINKING_DISABLED,
  errors.OAUTH_ACCOUNT_ALREADY_LINKED,
  errors.OAUTH_MODE_INVALID,
  errors.OAUTH_DISCOVERY_REDIRECT_MISSING,
  errors.DISCOVERY_REQUEST_INVALID,
  errors.ANONYMOUS_USER_NOT_FOUND,
  errors.EMAIL_NOT_ALLOWED,
  errors.USER_EXISTS,
  errors.LINK_CONFLICT,
  errors.TEAM_INVITE_NOT_FOUND,
  errors.SIGNING_KEYS_UNAVAILABLE,
  errors.AUTHORIZATION_UNAVAILABLE,
  errors.OAUTH_PROVIDER_REQUEST_FAILED,
  authErrors.USER_BLOCKED,
  authErrors.SESSION_REGISTRY_UNAVAILABLE,
];

/** The routes where a client sends a provider token (`authMiddleware?`, anonymous check). */
export const OAUTH_CLIENT_ROUTE_ERRORS = [
  ...OAUTH_ROUTE_ERRORS,
  authErrors.AUTH_TOKEN_MISSING,
  authErrors.AUTH_HEADER_MALFORMED,
  authErrors.TOKEN_INVALID,
  authErrors.TWO_FA_REQUIRED,
  authErrors.SESSION_REVOKED,
  errors.ANONYMOUS_USERS_DISABLED,
];

/** The init and initNative routes (they resolve the realm and strategy, start no session). */
export const OAUTH_INIT_ROUTE_ERRORS = [
  errors.OAUTH_MODE_INVALID,
  errors.DISCOVERY_REQUEST_INVALID,
  errors.STRATEGY_DISABLED,
  errors.STRATEGY_NOT_AVAILABLE_FOR_REALM,
  errors.REALM_NOT_FOUND,
  errors.REALMS_DISABLED,
  errors.REALM_SLUG_INVALID,
  errors.AUTH_OPERATION_FAILED,
  ...OAUTH_CLIENT_ROUTE_ERRORS.slice(OAUTH_ROUTE_ERRORS.length),
];

export function getRedirectableOAuthErrorCode(err: unknown): string | undefined {
  const code = parseConduitCode(err);
  return OAUTH_REDIRECTABLE_ERRORS.find(definition => definition.conduitCode === code)
    ?.conduitCode;
}

export function redirectOnRegistrationNotAllowed(
  err: unknown,
  redirectUri?: string,
): { redirect: string } {
  const conduitCode = getRedirectableOAuthErrorCode(err);
  if (!conduitCode || !redirectUri) {
    throw err;
  }
  try {
    const redirectUrl = new URL(redirectUri);
    redirectUrl.searchParams.set('conduitCode', conduitCode);
    return { redirect: redirectUrl.toString() };
  } catch {
    throw err;
  }
}
