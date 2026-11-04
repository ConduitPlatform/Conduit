import { createDecoder, createVerifier } from 'fast-jwt';
import { status } from '@grpc/grpc-js';
import { AccessTokenClaims, GrpcError } from '@conduitplatform/grpc-sdk';

export interface AccessTokenSigningKeys {
  kid: string;
  /** PEM (SPKI) Ed25519 public key. */
  publicKey: string;
  previousKid?: string;
  previousPublicKey?: string;
  /** Epoch ms until which the previous key is still accepted. 0 (or unset) means no previous key. */
  previousRetiredAt?: number;
}

export interface AccessTokenVerifierState {
  tokenVersion: number;
  signing: AccessTokenSigningKeys;
}

export interface AccessTokenVerifyOptions {
  /** Client id of the request. When set, it must equal the token's `cid`. */
  clientId?: string;
  /** Current time in epoch milliseconds. Defaults to Date.now(). */
  now?: number;
  /** Clock skew tolerance for `exp`. Defaults to 5 seconds. */
  leewaySeconds?: number;
}

export const DEFAULT_LEEWAY_SECONDS = 5;

const verifiers = new Map<string, ReturnType<typeof createVerifier>>();
const decode = createDecoder({ complete: true });

function fail(reason: string): never {
  throw new GrpcError(status.UNAUTHENTICATED, reason);
}

function getVerifier(publicKey: string) {
  let verifier = verifiers.get(publicKey);
  if (!verifier) {
    // Expiry is checked here (with leeway and an injectable clock), not by fast-jwt.
    verifier = createVerifier({
      key: publicKey,
      algorithms: ['EdDSA'],
      ignoreExpiration: true,
      ignoreNotBefore: true,
      cache: false,
    });
    verifiers.set(publicKey, verifier);
  }
  return verifier;
}

/** Picks the public key for `kid`: the current key, or the previous one while its retirement is in the future. */
export function selectVerificationKey(
  kid: string | undefined,
  signing: AccessTokenSigningKeys,
  now: number,
): string | undefined {
  if (!kid) return undefined;
  if (signing.publicKey && kid === signing.kid) return signing.publicKey;
  if (
    signing.previousKid &&
    signing.previousPublicKey &&
    kid === signing.previousKid &&
    (signing.previousRetiredAt ?? 0) > now
  ) {
    return signing.previousPublicKey;
  }
  return undefined;
}

/**
 * Verifies an Ed25519 access token. Throws GrpcError(UNAUTHENTICATED) with a short,
 * key-material-free reason on any failure.
 */
export function verifyAccessToken(
  token: string,
  state: AccessTokenVerifierState,
  options: AccessTokenVerifyOptions = {},
): AccessTokenClaims {
  const now = options.now ?? Date.now();
  const leeway = options.leewaySeconds ?? DEFAULT_LEEWAY_SECONDS;
  if (typeof token !== 'string' || token.length === 0) fail('malformed token');

  let kid: string | undefined;
  try {
    const decoded = decode(token);
    if (decoded.header.alg !== 'EdDSA') fail('unsupported algorithm');
    kid = decoded.header.kid;
  } catch (e) {
    if (e instanceof GrpcError) throw e;
    fail('malformed token');
  }

  const key = selectVerificationKey(kid, state.signing, now);
  if (!key) fail('unknown kid');

  let claims: AccessTokenClaims;
  try {
    claims = getVerifier(key)(token) as unknown as AccessTokenClaims;
  } catch {
    fail('bad signature');
  }

  if (
    typeof claims.sub !== 'string' ||
    typeof claims.sid !== 'string' ||
    typeof claims.exp !== 'number'
  ) {
    fail('malformed token');
  }
  if (now / 1000 >= claims.exp + leeway) fail('expired');
  if (claims.tv !== state.tokenVersion) fail('version mismatch');
  if (options.clientId !== undefined && claims.cid !== options.clientId) {
    fail('client mismatch');
  }
  return claims;
}
