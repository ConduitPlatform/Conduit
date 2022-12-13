import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import ConduitGrpcSdk, {
  GrpcError,
  Indexable,
  ParsedRouterRequest,
  PlatformTypesEnum,
  SMS,
} from '@conduitplatform/grpc-sdk';
import { Client, Token, User } from '../models';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import { v4 as uuid } from 'uuid';
import { Config } from '../config';
import axios from 'axios';

export namespace AuthUtils {
  export function randomToken(size = 64) {
    return crypto.randomBytes(size).toString('base64');
  }

  export async function createToken(
    dbUserId: string,
    data: Indexable,
    tokenType: string,
  ) {
    await Token.getInstance()
      .deleteMany({
        user: dbUserId,
        type: tokenType,
      })
      .catch(e => {
        throw e;
      });
    return Token.getInstance().create({
      user: dbUserId,
      type: tokenType,
      token: uuid(),
      data: data,
    });
  }

  export async function dbUserChecks(user: User, password: string) {
    const dbUser: User | null = await User.getInstance().findOne(
      { _id: user._id },
      '+hashedPassword',
    );
    const isNilDbUser = isNil(dbUser);
    if (isNilDbUser) {
      throw new GrpcError(status.UNAUTHENTICATED, 'User does not exist');
    }
    const isNilHashedPassword = isNil(dbUser.hashedPassword);
    if (isNilHashedPassword) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'User does not use password authentication',
      );
    }

    const passwordsMatch = await AuthUtils.checkPassword(
      password,
      dbUser.hashedPassword!,
    );
    if (!passwordsMatch) {
      throw new GrpcError(status.UNAUTHENTICATED, 'Invalid password');
    }
    return dbUser;
  }

  export function verify(token: string, secret: string): string | object | null {
    try {
      return jwt.verify(token, secret);
    } catch (error) {
      return null;
    }
  }

  export async function hashPassword(password: string, hashRounds = 10) {
    return bcrypt.hash(password, hashRounds);
  }

  export async function checkPassword(password: string, hashed: string) {
    return bcrypt.compare(password, hashed);
  }

  export async function verifyCode(
    grpcSdk: ConduitGrpcSdk,
    token: Token,
    code: string,
  ): Promise<boolean> {
    const verified = await grpcSdk.sms!.verify(token.data.verification, code);
    if (!verified.verified) {
      return false;
    }
    await Token.getInstance()
      .deleteMany({
        data: {
          phone: token.data.phone,
        },
        type: token.type,
      })
      .catch(e => {
        ConduitGrpcSdk.Logger.error(e);
      });
    return true;
  }

  export async function sendVerificationCode(sms: SMS, to: string) {
    const verificationSid = await sms.sendVerificationCode(to);
    return verificationSid.verificationSid || '';
  }

  export function invalidEmailAddress(email: string) {
    return !email
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
      );
  }

  export function checkResendThreshold(token: Token, notBefore: number = 600000) {
    const diffInMilliSec = Math.abs(new Date(token.createdAt).getTime() - Date.now());
    if (diffInMilliSec < notBefore) {
      const remainTime = Math.ceil((notBefore - diffInMilliSec) / notBefore);
      throw new GrpcError(
        status.RESOURCE_EXHAUSTED,
        'Verification code not sent. You have to wait ' +
          remainTime +
          ' minutes to try again',
      );
    } else {
      return true;
    }
  }
}

export async function validateCaptcha(provider: string, secret: string, captcha: string) {
  let verifyCaptchaUrl = '';
  if (provider === 'recaptcha') {
    verifyCaptchaUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${captcha}`;
  } else if (provider === 'hcaptcha') {
    verifyCaptchaUrl = `https://hcaptcha.com/siteverify?secret=${secret}&response=${captcha}`;
  }
  const response = await axios.post(
    verifyCaptchaUrl,
    {},
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
      },
    },
  );
  if (!response.data.success) {
    throw new GrpcError(status.UNAUTHENTICATED, 'Can not verify captcha token');
  }
  return {};
}
