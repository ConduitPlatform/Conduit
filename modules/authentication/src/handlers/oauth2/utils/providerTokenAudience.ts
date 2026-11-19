import axios from 'axios';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { isNil } from 'lodash-es';
import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../../../errors.js';

export const GOOGLE_ISSUERS: [string, ...string[]] = [
  'accounts.google.com',
  'https://accounts.google.com',
];
export const FACEBOOK_DEBUG_TOKEN_URL = 'https://graph.facebook.com/debug_token';

type SigningKeyResolver = (kid: string) => Promise<{ getPublicKey(): string }>;

/**
 * Verifies a Google id_token (signature, issuer, expiry) and ensures it was
 * issued for the given client id.
 */
export async function verifyGoogleIdToken(
  idToken: unknown,
  expectedClientId: string,
  getSigningKey: SigningKeyResolver,
): Promise<JwtPayload> {
  if (typeof idToken !== 'string' || idToken.length === 0 || !expectedClientId) {
    throw new ModuleError(errors.OAUTH_PROVIDER_AUTH_FAILED);
  }
  const kid = jwt.decode(idToken, { complete: true })?.header?.kid;
  if (!kid) throw new ModuleError(errors.OAUTH_PROVIDER_AUTH_FAILED);
  let publicKey: string;
  try {
    publicKey = (await getSigningKey(kid)).getPublicKey();
  } catch (error) {
    if (error instanceof Error && error.name === 'SigningKeyNotFoundError') {
      throw new ModuleError(errors.OAUTH_PROVIDER_AUTH_FAILED);
    }
    throw new ModuleError(
      errors.OAUTH_PROVIDER_REQUEST_FAILED,
      error instanceof Error ? error.message : String(error),
    );
  }
  let payload: JwtPayload;
  try {
    payload = jwt.verify(idToken, publicKey, {
      algorithms: ['RS256'],
      issuer: GOOGLE_ISSUERS,
      audience: expectedClientId,
    }) as JwtPayload;
  } catch {
    throw new ModuleError(errors.OAUTH_PROVIDER_AUTH_FAILED);
  }
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new ModuleError(errors.OAUTH_PROVIDER_AUTH_FAILED);
  }
  return payload;
}

/**
 * Ensures a Facebook user access token is valid and was issued for the given app.
 */
export async function assertFacebookTokenAudience(
  accessToken: string,
  appId: string,
  appSecret: string,
): Promise<void> {
  if (!accessToken || !appId || !appSecret) {
    throw new ModuleError(errors.OAUTH_PROVIDER_AUTH_FAILED);
  }
  const response = await axios
    .get(FACEBOOK_DEBUG_TOKEN_URL, {
      params: {
        input_token: accessToken,
        access_token: `${appId}|${appSecret}`,
      },
    })
    .catch(error => {
      throw new ModuleError(errors.OAUTH_PROVIDER_REQUEST_FAILED, error?.message);
    });
  const data = response?.data?.data;
  if (isNil(data) || data.is_valid !== true || String(data.app_id) !== String(appId)) {
    throw new ModuleError(errors.OAUTH_PROVIDER_AUTH_FAILED);
  }
}
