import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import jwt, { JwtPayload } from 'jsonwebtoken';

export function verifyAppleIdentityToken(
  applePublicKey: string,
  id_token: string,
  expectedAudience: string | string[],
): JwtPayload {
  try {
    return jwt.verify(id_token, applePublicKey, {
      algorithms: ['ES256'],
      issuer: 'https://appleid.apple.com',
      audience: expectedAudience,
    }) as JwtPayload;
  } catch {
    throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid token');
  }
}
