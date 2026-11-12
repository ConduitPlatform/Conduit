import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';
import jwt, { JwtPayload } from 'jsonwebtoken';

export function verifyAppleIdentityToken(
  applePublicKey: string,
  id_token: string,
  expectedAudience: string,
): JwtPayload {
  try {
    return jwt.verify(id_token, applePublicKey, {
      algorithms: ['ES256'],
      issuer: 'https://appleid.apple.com',
      audience: expectedAudience,
    }) as JwtPayload;
  } catch {
    throw new ModuleError(errors.APPLE_TOKEN_INVALID);
  }
}
