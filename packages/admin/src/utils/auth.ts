import * as jwt from 'jsonwebtoken';
import { compare, hash } from 'bcrypt';
import { Admin, ConfigController, GrpcError } from '@conduitplatform/grpc-sdk';
import { AdminTwoFactorSecret } from '../../dist/models';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import * as twoFactor from 'node-2fa';

export function signToken(data: any, secret: string, expiresIn?: number) {
  return jwt.sign(data, secret, { expiresIn: expiresIn ?? '6 hours' });
}

export function verifyToken(token: string, secret: string): any {
  return jwt.verify(token, secret);
}
export function verifyTwoFactorToken(secret: string, token?: string, window?: number) {
  return twoFactor.verifyToken(secret, token, window);
}

export async function hashPassword(password: string, rounds?: number) {
  return hash(password, rounds ?? 11);
}

export function comparePasswords(password: string, hashed: string) {
  return compare(password, hashed);
}
export function generateToken(secret: string) {
  return twoFactor.generateToken(secret);
}
export async function verify2Fa(adminId: string, admin: Admin, code: string) {
  const secret = await AdminTwoFactorSecret.getInstance().findOne({
    adminId: adminId,
  });
  if (isNil(secret)) throw new GrpcError(status.NOT_FOUND, 'Verification unsuccessful');

  const verification = verifyTwoFactorToken(secret.secret, code);
  if (isNil(verification)) {
    throw new GrpcError(status.UNAUTHENTICATED, 'Verification unsuccessful');
  }
  const authConfig = ConfigController.getInstance().config.auth;
  const { tokenSecret, tokenExpirationTime } = authConfig;
  const token = signToken({ id: adminId }, tokenSecret, tokenExpirationTime);
  return { result: { token } }; // unnested from result in Rest.addConduitRoute, grpc routes avoid this using wrapRouterGrpcFunction
}

export function generateSecret(options?: { name: string; account: string }) {
  return twoFactor.generateSecret(options);
}
