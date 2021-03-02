import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import { AuthUtils } from '../utils/auth';
import moment from 'moment';
import { ISignTokenOptions } from '../interfaces/ISignTokenOptions';

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
