import jwt from 'jsonwebtoken';
import { compare, hash } from 'bcrypt';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { Admin, AdminTwoFactorSecret } from '../../models/index.js';
import { isNil } from 'lodash-es';
import { status } from '@grpc/grpc-js';
import * as twoFactor from '@conduitplatform/node-2fa';

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

export async function verify2Fa(admin: Admin, code: string) {
  const secret = await AdminTwoFactorSecret.getInstance().findOne({
    adminId: admin._id,
  });
  if (isNil(secret)) throw new GrpcError(status.NOT_FOUND, 'Verification unsuccessful');

  const verification = verifyTwoFactorToken(secret.secret, code, 1);
  if (isNil(verification)) {
    throw new GrpcError(status.UNAUTHENTICATED, 'Verification unsuccessful');
  }
  const authConfig = ConfigController.getInstance().config.auth;
  const { tokenSecret, tokenExpirationTime } = authConfig;
  return signToken({ id: admin._id }, tokenSecret, tokenExpirationTime);
}

export function generateSecret(options?: { name: string; account: string }) {
  return twoFactor.generateSecret(options);
}
