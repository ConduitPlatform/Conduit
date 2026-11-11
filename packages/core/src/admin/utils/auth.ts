import jwt from 'jsonwebtoken';
import { compare, hash } from 'bcrypt';
import { type FindOneOptions } from '@conduitplatform/grpc-sdk';
import { ConfigController, ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../../errors.js';
import { Admin, AdminTwoFactorSecret } from '../../models/index.js';
import { isNil } from 'lodash-es';
import * as twoFactor from '@conduitplatform/node-2fa';

export function signToken(data: any, secret: string, expiresIn?: number) {
  return jwt.sign(data, secret, {
    expiresIn: expiresIn ?? '6 hours',
    algorithm: 'HS256',
  });
}

export function verifyToken(token: string, secret: string): any {
  return jwt.verify(token, secret, { algorithms: ['HS256'] });
}

export function verifyTwoFactorToken(
  secret: string,
  token?: string,
  window?: number,
): ReturnType<typeof twoFactor.verifyToken> {
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
  const secret = await AdminTwoFactorSecret.getInstance().findOne(
    { adminId: admin._id },
    { readPreference: 'primary' } satisfies FindOneOptions,
  );
  if (isNil(secret)) throw new ModuleError(errors.ADMIN_TWO_FA_NOT_CONFIGURED);

  const verification = verifyTwoFactorToken(secret.secret, code, 1);
  if (isNil(verification)) {
    throw new ModuleError(errors.ADMIN_TWO_FA_CODE_INVALID);
  }
  const authConfig = ConfigController.getInstance().config.auth;
  const { tokenSecret, tokenExpirationTime } = authConfig;
  return signToken({ id: admin._id }, tokenSecret, tokenExpirationTime);
}

export async function generateSecret(options?: { name: string; account: string }) {
  return twoFactor.generateSecret(options);
}
