import { GrpcError } from '@conduitplatform/grpc-sdk';
import { ConduitString, ModuleError } from '@conduitplatform/module-tools';
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
  throw new GrpcError(status.INVALID_ARGUMENT, 'mode must be "signIn" or "both"');
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
] as const;

/** Errors declared on the OAuth routes: the redirectable ones plus realm resolution. */
export const OAUTH_ROUTE_ERRORS = [
  ...OAUTH_REDIRECTABLE_ERRORS,
  errors.REALM_NOT_FOUND,
  errors.REALMS_DISABLED,
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
