import * as jwt from 'jsonwebtoken';
import { compare, hash } from 'bcrypt';
import { ConduitCommons } from '@conduitplatform/conduit-commons';

export function signToken(data: any, secret: string, expiresIn?: number) {
  return jwt.sign(data, secret, { expiresIn: expiresIn ?? '6 hours' });
}

export function verifyToken(token: string, secret: string): any {
  return jwt.verify(token, secret);
}

export async function hashPassword(password: string, rounds?: number) {
  return hash(password, rounds ?? 11);
}

export function comparePasswords(password: string, hashed: string) {
  return compare(password, hashed);
}
