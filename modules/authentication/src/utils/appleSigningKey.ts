import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';

export function decodeAppleTokenKid(id_token: string): string {
  const decoded = jwt.decode(id_token, { complete: true });
  const kid = decoded?.header?.kid;
  if (!kid) {
    throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid token');
  }
  return kid;
}

export function isSigningKeyNotFoundError(error: unknown): boolean {
  if (error instanceof jwksRsa.SigningKeyNotFoundError) {
    return true;
  }
  return error instanceof Error && error.name === 'SigningKeyNotFoundError';
}

export function mapJwksSigningKeyError(error: unknown): GrpcError {
  if (isSigningKeyNotFoundError(error)) {
    return new GrpcError(status.INVALID_ARGUMENT, 'Invalid token');
  }
  return new GrpcError(status.UNAVAILABLE, 'Unable to verify identity token');
}

export async function resolveAppleSigningKey(
  id_token: string,
  getSigningKey: (kid: string) => Promise<{ getPublicKey(): string }>,
): Promise<string> {
  const kid = decodeAppleTokenKid(id_token);
  try {
    const key = await getSigningKey(kid);
    return key.getPublicKey();
  } catch (error) {
    throw mapJwksSigningKeyError(error);
  }
}
