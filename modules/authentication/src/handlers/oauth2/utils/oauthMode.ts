import { GrpcError } from '@conduitplatform/grpc-sdk';
import { ConduitString, ModuleError } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { errors } from '../../../errors.js';

export type OAuthMode = 'signIn' | 'both';

export const OAUTH_MODE_PARAM = ConduitString.OptionalWith({
  pattern: '^(signIn|both)$',
  message: 'mode must be "signIn" or "both"',
});

export function resolveOAuthMode(
  value: unknown,
  allowRegistration: boolean = true,
): OAuthMode {
  let requested: OAuthMode;
  if (value === undefined || value === null || value === '') {
    requested = 'both';
  } else if (value === 'signIn' || value === 'both') {
    requested = value;
  } else {
    throw new GrpcError(status.INVALID_ARGUMENT, 'mode must be "signIn" or "both"');
  }
  return allowRegistration ? requested : 'signIn';
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
