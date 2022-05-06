import * as crypto from 'crypto';
import { ISignTokenOptions } from '../interfaces/ISignTokenOptions';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import ConduitGrpcSdk, {
  GrpcError,
  SMS,
  ConfigController,
} from '@conduitplatform/grpc-sdk';
import moment from 'moment';
import { AccessToken, RefreshToken, Token, User } from '../models';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';

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

  export async function verifyCode(grpcSdk: ConduitGrpcSdk, clientId: string, user: User, tokenType: string, code: string): Promise<any> {

    const verificationRecord: Token | null = await Token.getInstance().findOne({
      userId: user._id,
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
        userId: user._id,
        type: tokenType,
      })
      .catch(console.error);

    const config = ConfigController.getInstance().config;

    await Promise.all(
      deleteUserTokens(grpcSdk, {
        userId: user._id,
        clientId,
      }),
    );

    const signTokenOptions: ISignTokenOptions = {
      secret: config.jwtSecret,
      expiresIn: config.tokenInvalidationPeriod,
    };

    const accessToken: AccessToken = await AccessToken.getInstance().create({
      userId: user._id,
      clientId,
      token: signToken({ id: user._id }, signTokenOptions),
      expiresOn: moment()
        .add(config.tokenInvalidationPeriod as number, 'milliseconds')
        .toDate(),
    });

    const refreshToken: RefreshToken = await RefreshToken.getInstance().create({
      userId: user._id,
      clientId,
      token: randomToken(),
      expiresOn: moment()
        .add(config.refreshTokenInvalidationPeriod as number, 'milliseconds')
        .toDate(),
    });

    return {
      userId: user._id.toString(),
      accessToken: accessToken.token,
      refreshToken: refreshToken.token,
    };
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
    let refreshToken;
    if (tokenOptions.config.generateRefreshToken) {
      refreshToken = sdk.databaseProvider!.create('RefreshToken', {
        userId: tokenOptions.userId,
        clientId: tokenOptions.clientId,
        token: AuthUtils.randomToken(),
        expiresOn: moment()
          .add(tokenOptions.config.refreshTokenInvalidationPeriod, 'milliseconds')
          .toDate(),
      });
    }

    return [accessToken, refreshToken];
  }

  export function createUserTokensAsPromise(
    sdk: ConduitGrpcSdk,
    tokenOptions: TokenOptions,
  ) {
    return Promise.all(createUserTokens(sdk, tokenOptions));
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

  export async function signInClientOperations(grpcSdk: ConduitGrpcSdk, clientConfig: any, userId: string, clientId: string) {
    const isAnonymous = ('anonymous-client' === clientId);
    if (isAnonymous) {
      if (!clientConfig.multipleUserSessions) {
        await Promise.all(
          AuthUtils.deleteUserTokens(grpcSdk, {
            userId: userId,
          }),
        );
      }
    } else {
      if (clientConfig.multipleClientLogins) {  //if can login from multiple devices
        if (!clientConfig.multipleUserSessions) {  // if can not log in from single device multiple times
          await Promise.all(
            AuthUtils.deleteUserTokens(grpcSdk, {
              userId: userId,
              clientId,
            }),
          );
        }
      } else {
        if (!clientConfig.multipleUserSessions) {
          await Promise.all(
            AuthUtils.deleteUserTokens(grpcSdk, {
              userId: userId,
            }),
          );
        }
      }
    }
  }

  export async function logOutClientOperations(grpcSdk: ConduitGrpcSdk, clientConfig: any, authToken: string, clientId: string, userId: string) {
    const isAnonymous = ('anonymous-client' === clientId);
    const token = authToken.split(' ')[1];
    if (isAnonymous) {
      if (!clientConfig.multipleUserSessions) {
        await Promise.all(
          AuthUtils.deleteUserTokens(grpcSdk, {
            userId: userId,
            clientId: 'anonymous-client',
          }),
        );
      } else {
        await Promise.all(
          AuthUtils.deleteUserTokens(grpcSdk, {
            token: token,
          }),
        );
      }
    } else {
      if (clientConfig.multipleClientLogins) {
        if (clientConfig.multipleUserSessions) {
          await Promise.all(
            AuthUtils.deleteUserTokens(grpcSdk, {
              token: token,
            }),
          );
        } else {
          await Promise.all(
            AuthUtils.deleteUserTokens(grpcSdk, {
              clientId,
              userId: userId,
            }),
          );
        }
      } else {
        await Promise.all(
          AuthUtils.deleteUserTokens(grpcSdk, {
            userId: userId,
          }),
        );
      }
    }
  }
}
