import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';

export function decodeAppleTokenKid(id_token: string): string {
  const decoded = jwt.decode(id_token, { complete: true });
  const kid = decoded?.header?.kid;
  if (!kid) {
    throw new ModuleError(errors.APPLE_TOKEN_INVALID);
  }
  return kid;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isSigningKeyNotFoundError(error: unknown): boolean {
  if (error instanceof jwksRsa.SigningKeyNotFoundError) {
    return true;
  }
  return error instanceof Error && error.name === 'SigningKeyNotFoundError';
}

export function mapJwksSigningKeyError(error: unknown): ModuleError {
  if (isSigningKeyNotFoundError(error)) {
    return new ModuleError(errors.APPLE_TOKEN_INVALID, errorText(error));
  }
  return new ModuleError(errors.APPLE_KEYS_UNAVAILABLE, errorText(error));
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
