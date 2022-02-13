import * as crypto from 'crypto';
import { ISignTokenOptions } from '../interfaces/ISignTokenOptions';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import moment from 'moment';

export namespace AuthUtils {
  export function randomToken(size = 64) {
    return crypto.randomBytes(size).toString('base64');
  }

  export function signToken(data: { [key: string]: any }, options: ISignTokenOptions) {
    const { secret, expiresIn } = options;
    return jwt.sign(data, secret, { expiresIn });
  }

  export function verify(token: string, secret: string): any {
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

  export interface TokenOptions {
    userId: string;
    clientId: string;
    config: any;
  }

  export function deleteUserTokens(sdk: ConduitGrpcSdk, query: any) {
    let promise1 = sdk.databaseProvider!.deleteMany('AccessToken', query);
    let promise2 = sdk.databaseProvider!.deleteMany('RefreshToken', query);

    return [promise1, promise2];
  }

  export function deleteUserTokensAsPromise(sdk: ConduitGrpcSdk, query: any) {
    return Promise.all(deleteUserTokens(sdk, query));
  }

  export function createUserTokens(sdk: ConduitGrpcSdk, tokenOptions: TokenOptions) {
    const signTokenOptions: ISignTokenOptions = {
      secret: tokenOptions.config.jwtSecret,
      expiresIn: tokenOptions.config.tokenInvalidationPeriod,
    };
    const accessToken = sdk.databaseProvider!.create('AccessToken', {
      userId: tokenOptions.userId,
      clientId: tokenOptions.clientId,
      token: AuthUtils.signToken({ id: tokenOptions.userId }, signTokenOptions),
      expiresOn: moment()
        .add(tokenOptions.config.tokenInvalidationPeriod as number, 'milliseconds')
        .toDate(),
    });

    const refreshToken = sdk.databaseProvider!.create('RefreshToken', {
      userId: tokenOptions.userId,
      clientId: tokenOptions.clientId,
      token: AuthUtils.randomToken(),
      expiresOn: moment()
        .add(tokenOptions.config.refreshTokenInvalidationPeriod, 'milliseconds')
        .toDate(),
    });

    return [accessToken, refreshToken];
  }

  export function createUserTokensAsPromise(
    sdk: ConduitGrpcSdk,
    tokenOptions: TokenOptions
  ) {
    return Promise.all(createUserTokens(sdk, tokenOptions));
  }
}
