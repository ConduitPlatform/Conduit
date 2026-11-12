import {
  ModuleErrorDefinition,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { authErrors, ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';
import { User } from '../models/index.js';
import { Config } from '../config/index.js';
import { AuthUtils } from '../utils/index.js';

/** Codes of `authMiddleware` (session mode), declared by every authenticated route. */
export const SESSION_AUTH_ERRORS = [
  authErrors.AUTH_TOKEN_MISSING,
  authErrors.AUTH_HEADER_MALFORMED,
  authErrors.TOKEN_INVALID,
  authErrors.TWO_FA_REQUIRED,
  authErrors.SESSION_REVOKED,
  authErrors.USER_BLOCKED,
  authErrors.SESSION_REGISTRY_UNAVAILABLE,
];

/** Codes of `resolveRealmFromCall/Slug` (a realm is given) and of the strategy gate. */
export const REALM_RESOLUTION_ERRORS = [
  errors.REALM_NOT_FOUND,
  errors.REALMS_DISABLED,
  errors.REALM_SLUG_INVALID,
  errors.STRATEGY_NOT_AVAILABLE_FOR_REALM,
  errors.STRATEGY_DISABLED,
];

/** Codes of `TokenProvider.provideUserTokens`/`provideRenewedAccessToken`. */
export const TOKEN_ISSUANCE_ERRORS = [
  errors.REALM_ACCESS_DENIED,
  errors.TWO_FA_REQUIRED_FOR_REALM,
  errors.GUESTS_NOT_ALLOWED,
  errors.REALM_NOT_FOUND,
  authErrors.USER_BLOCKED,
  errors.SIGNING_KEYS_UNAVAILABLE,
  authErrors.SESSION_REGISTRY_UNAVAILABLE,
  errors.AUTHORIZATION_UNAVAILABLE,
];

function without(
  from: ModuleErrorDefinition[],
  ...others: ModuleErrorDefinition[][]
): ModuleErrorDefinition[] {
  const skip = new Set(others.flat().map(e => e.conduitCode));
  return from.filter(e => !skip.has(e.conduitCode));
}

/** Realm resolution, strategy gate and token issuance: unauthenticated login routes. */
export const LOGIN_ROUTE_ERRORS = [
  ...REALM_RESOLUTION_ERRORS,
  ...without(TOKEN_ISSUANCE_ERRORS, REALM_RESOLUTION_ERRORS),
];

/** Token issuance codes not already covered by `authMiddleware` (authenticated routes). */
export const AUTHENTICATED_TOKEN_ERRORS = without(
  TOKEN_ISSUANCE_ERRORS,
  SESSION_AUTH_ERRORS,
);

/** Codes of `denyAnonymousMiddleware`. */
export const ANONYMOUS_DENIED_ERRORS = [errors.ANONYMOUS_USER_NOT_ELIGIBLE];

/** Codes of `captchaMiddleware` (only when captcha is enabled for the route). */
export const CAPTCHA_ERRORS = [
  errors.CAPTCHA_DISABLED,
  errors.CAPTCHA_TOKEN_MISSING,
  errors.CAPTCHA_VERIFICATION_FAILED,
];

/** Code of `checkAnonymousMiddleware`. */
export const ANONYMOUS_CONFIG_ERRORS = [errors.ANONYMOUS_USERS_DISABLED];

export async function changePassword(
  call: ParsedRouterRequest,
): Promise<UnparsedRouterResponse> {
  if (!call.request.context.jwtPayload.sudo) {
    throw new ModuleError(errors.SUDO_REQUIRED);
  }
  const { user } = call.request.context;
  const { newPassword } = call.request.bodyParams;
  const hashedPassword = await AuthUtils.hashPassword(newPassword);
  await User.getInstance().findByIdAndUpdate(user._id, { hashedPassword });
  return 'Password changed successfully';
}

export async function authenticateChecks(
  password: string,
  config: Config,
  user: User,
  overrides?: { verificationRequired?: boolean },
) {
  if (!user.active) throw new ModuleError(authErrors.USER_BLOCKED);
  if (!user.hashedPassword) throw new ModuleError(errors.PASSWORD_AUTH_NOT_AVAILABLE);
  const passwordsMatch = await AuthUtils.checkPassword(password, user.hashedPassword);
  if (!passwordsMatch) throw new ModuleError(errors.INVALID_CREDENTIALS);

  const verificationRequired =
    overrides?.verificationRequired ?? config.local.verification.required;
  if (verificationRequired && !user.isVerified) {
    throw new ModuleError(errors.ACCOUNT_NOT_VERIFIED);
  }
}
