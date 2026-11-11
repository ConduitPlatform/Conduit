import {
  AccessTokenClaims,
  ConduitGrpcSdk,
  GrpcError,
  Indexable,
} from '@conduitplatform/grpc-sdk';
import { authErrors, ModuleError } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';

/*
 * The jwt-mode branch of the authentication middleware: verify the signed token, apply
 * the 2FA path whitelist and (optionally) strict revocation, then load the user. The
 * verifier, the session registry and the user lookup are injected.
 */

export const TWO_FA_PATHS = [
  '/authentication/twoFa/verify',
  '/authentication/twoFa/authorize',
  '/authentication/twoFa/recover',
];

export interface JwtAuthenticationDeps {
  verifier: {
    readonly strictRevocation: boolean;
    verify(token: string, options?: { clientId?: string }): AccessTokenClaims;
  };
  registry: { exists(sid: string): Promise<boolean> };
  /** rejects with a GrpcError NOT_FOUND for an unknown user */
  resolveUser: (userId: string) => Promise<Indexable>;
  /** the realms feature flag: without it the session carries no realm */
  realmsEnabled: () => boolean;
}

export async function authenticateJwt(
  deps: JwtAuthenticationDeps,
  params: { token: string; clientId?: string; path: string },
) {
  const claims = deps.verifier.verify(params.token, { clientId: params.clientId });
  if (!claims.authorized && !TWO_FA_PATHS.includes(params.path)) {
    throw new ModuleError(authErrors.TWO_FA_REQUIRED);
  }
  if (deps.verifier.strictRevocation) {
    let exists: boolean;
    try {
      exists = await deps.registry.exists(claims.sid);
    } catch (e) {
      ConduitGrpcSdk.Logger.warn(
        `Session registry check failed: ${(e as Error)?.message ?? e}`,
      );
      throw new ModuleError(authErrors.SESSION_REGISTRY_UNAVAILABLE);
    }
    if (!exists) {
      throw new ModuleError(authErrors.SESSION_REVOKED);
    }
  }
  let user: Indexable;
  try {
    user = await deps.resolveUser(claims.sub);
  } catch (e) {
    // a deleted user answers like a blocked one in session mode
    if ((e as GrpcError)?.code === status.NOT_FOUND) {
      throw new ModuleError(authErrors.USER_BLOCKED);
    }
    throw e;
  }
  if (!user || !user.active) {
    throw new ModuleError(authErrors.USER_BLOCKED);
  }
  return {
    user,
    jwtPayload: claims,
    // realm the session is in (team id), null for global sessions
    realm: deps.realmsEnabled() ? (claims.rid ?? null) : null,
    sessionId: claims.sid,
  };
}
