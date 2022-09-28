import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import ConduitGrpcSdk, {
  ConfigController,
  GrpcError,
  Indexable,
  SMS,
} from '@conduitplatform/grpc-sdk';
import { Token, User } from '../models';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import { v4 as uuid } from 'uuid';
import { TokenProvider } from '../handlers/tokenProvider';

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
    return await Token.getInstance().create({
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
    clientId: string,
    user: User,
    tokenType: string,
    code: string,
  ): Promise<any> {
    const verificationRecord: Token | null = await Token.getInstance().findOne({
      user: user._id,
      type: tokenType,
    });
    if (isNil(verificationRecord))
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'No verification record for this user',
      );

    const verified = await grpcSdk.sms!.verify(verificationRecord.token, code);

    if (!verified.verified) {
      throw new GrpcError(status.UNAUTHENTICATED, 'email and code do not match');
    }

    await Token.getInstance()
      .deleteMany({
        user: user._id,
        type: tokenType,
      })
      .catch(e => {
        ConduitGrpcSdk.Logger.error(e);
      });

    const config = ConfigController.getInstance().config;

    return TokenProvider.getInstance(grpcSdk)!.provideUserTokens({
      user,
      clientId,
      config,
      twoFaPass: true,
    });
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
}
