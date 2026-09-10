import { GrpcError } from '@conduitplatform/grpc-sdk';
import { ConduitString, ModuleError } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { errors } from '../../../errors.js';

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

export function assertOAuthRegistrationAllowed(mode: OAuthMode): void {
  switch (mode) {
    case 'both':
      return;
    case 'signIn':
      throw new ModuleError(errors.REGISTRATION_NOT_ALLOWED);
    default: {
      const _exhaustive: never = mode;
      throw new GrpcError(status.INTERNAL, `Unhandled OAuth mode: ${_exhaustive}`);
    }
  }
}
