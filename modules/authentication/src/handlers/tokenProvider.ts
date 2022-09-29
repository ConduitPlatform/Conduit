import ConduitGrpcSdk, { Query } from '@conduitplatform/grpc-sdk';
import { AccessToken, RefreshToken, User } from '../models';
import { ISignTokenOptions } from '../interfaces/ISignTokenOptions';
import moment from 'moment/moment';
import { AuthUtils } from '../utils/auth';
import * as jwt from 'jsonwebtoken';
import { Config } from '../config';
import { Cookie } from '../interfaces/Cookie';
import { isNil } from 'lodash';

export interface TokenOptions {
  user: User;
  clientId: string;
  config: Config;
  twoFaPass?: boolean;
  isRefresh?: boolean;
  noSudo?: boolean;
}

export class TokenProvider {
  private static _instance: TokenProvider;

  private constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  public static getInstance(grpcSdk?: ConduitGrpcSdk) {
    if (TokenProvider._instance) return TokenProvider._instance;
    if (!grpcSdk) throw new Error('GrpcSdk not provided');
    TokenProvider._instance = new TokenProvider(grpcSdk);
  }

  async provideUserTokens(tokenOptions: TokenOptions, redirectUrl?: string) {
    await this.signInClientOperations(
      this.grpcSdk,
      tokenOptions.config.clients,
      tokenOptions.user._id,
      tokenOptions.clientId,
    );
    const [accessToken, refreshToken] = await this.createUserTokens(tokenOptions);
    const cookies: { accessToken?: Cookie; refreshToken?: Cookie } =
      this.constructCookies(tokenOptions, [accessToken, refreshToken]);
    if (Object.keys(cookies).length > 0) {
      if (redirectUrl) {
        const redirectUrlWithParams = new URL(redirectUrl);
        if (!cookies.accessToken) {
          redirectUrlWithParams.searchParams.append('accessToken', accessToken.token);
        }
        if (!cookies.refreshToken && refreshToken) {
          redirectUrlWithParams.searchParams.append('refreshToken', refreshToken!.token);
        }
        return {
          redirectUrl: redirectUrlWithParams.toString(),
          setCookies: cookies,
        };
      } else {
        return {
          result: {
            message: 'Successfully authenticated',
            userId: tokenOptions.user._id.toString(),
            accessToken: cookies.accessToken ?? undefined,
            refreshToken: cookies.refreshToken ? undefined : refreshToken?.token,
          },
          setCookies: cookies,
        };
      }
    }
    if (redirectUrl) {
      const redirectUrlWithParams = new URL(redirectUrl);
      redirectUrlWithParams.searchParams.append('accessToken', accessToken.token);
      if (refreshToken) {
        redirectUrlWithParams.searchParams.append('refreshToken', refreshToken!.token);
      }
      return {
        redirectUrl: redirectUrlWithParams.toString(),
      };
    } else {
      return {
        userId: tokenOptions.user._id.toString(),
        accessToken: accessToken.token,
        refreshToken: refreshToken?.token,
      };
    }
  }

  // used only for the login grpc call
  async provideUserTokensInternal(tokenOptions: TokenOptions) {
    // do not escalate user permissions when created internally
    const [accessToken, refreshToken] = await this.createUserTokens({
      ...tokenOptions,
      noSudo: true,
    });
    return {
      userId: tokenOptions.user._id.toString(),
      accessToken: accessToken.token,
      refreshToken: refreshToken?.token,
    };
  }

  private createUserTokens(
    tokenOptions: TokenOptions,
  ): Promise<[AccessToken, RefreshToken?]> {
    const signTokenOptions: ISignTokenOptions = {
      secret: tokenOptions.config.accessTokens.jwtSecret,
      expiresIn: tokenOptions.config.accessTokens.expiryPeriod,
    };
    let authorized = false;
    if (
      !tokenOptions.user.hasTwoFA ||
      tokenOptions.isRefresh ||
      (tokenOptions.user.hasTwoFA && tokenOptions.twoFaPass)
    ) {
      authorized = true;
    }
    // to activate sudo, a user needs to have passed 2fa (if applicable)
    // the tokens should not be created during the refresh token flow
    // and the noSudo flag needs to be false or not set
    const sudo = authorized && !tokenOptions.isRefresh && !tokenOptions.noSudo;
    const accessTokenPromise = AccessToken.getInstance().create({
      user: tokenOptions.user._id,
      clientId: tokenOptions.clientId,
      token: this.signToken(
        { id: tokenOptions.user._id, authorized, sudo },
        signTokenOptions,
      ),
      expiresOn: moment()
        .add(tokenOptions.config.accessTokens.expiryPeriod as number, 'milliseconds')
        .toDate(),
    });
    const promises: [
      accesstoken: Promise<AccessToken>,
      refreshToken?: Promise<RefreshToken>,
    ] = [accessTokenPromise];
    let refreshTokenPromise;
    // do not construct refresh tokens when the user has 2fa enabled
    // the tokens will be constructed when the user has successfully verified the 2fa
    if (tokenOptions.config.refreshTokens.enabled && authorized) {
      refreshTokenPromise = RefreshToken.getInstance().create({
        user: tokenOptions.user._id,
        clientId: tokenOptions.clientId,
        token: AuthUtils.randomToken(),
        expiresOn: moment()
          .add(tokenOptions.config.refreshTokens.expiryPeriod, 'milliseconds')
          .toDate(),
      });
      promises.push(refreshTokenPromise);
    }
    return Promise.all(promises);
  }

  private constructCookies(
    tokenOptions: TokenOptions,
    tokens: [AccessToken, RefreshToken?],
  ) {
    const cookies: { accessToken?: Cookie; refreshToken?: Cookie } = {};
    if (tokenOptions.config.accessTokens.setCookie) {
      const cookieOptions = {
        ...tokenOptions.config.cookieOptions,
        ...tokenOptions.config.accessTokens.cookieOptions,
      };
      cookies.accessToken = {
        name: 'accessToken',
        value: (tokens[0] as AccessToken).token,
        options: cookieOptions,
      };
    }
    if (
      !isNil((tokens[1] as RefreshToken).token) &&
      tokenOptions.config.refreshTokens.setCookie
    ) {
      const cookieOptions = {
        ...tokenOptions.config.cookieOptions,
        ...tokenOptions.config.refreshTokens.cookieOptions,
      };
      cookies.refreshToken = {
        name: 'refreshToken',
        value: (tokens[1] as RefreshToken).token,
        options: cookieOptions,
      };
    }
    return cookies;
  }

  private signToken(data: { [key: string]: any }, options: ISignTokenOptions) {
    const { secret, expiresIn } = options;
    return jwt.sign(data, secret, { expiresIn });
  }

  async signInClientOperations(
    grpcSdk: ConduitGrpcSdk,
    clientConfig: { multipleUserSessions: boolean; multipleClientLogins: boolean },
    userId: string,
    clientId: string,
  ) {
    const isAnonymous = 'anonymous-client' === clientId;
    if (!clientConfig.multipleUserSessions) {
      await this.deleteUserTokens({
        user: userId,
        clientId: isAnonymous || !clientConfig.multipleClientLogins ? null : clientId,
      });
    } else if (!clientConfig.multipleClientLogins) {
      await this.deleteUserTokens({
        user: userId,
        clientId: { $ne: clientId },
      });
    }
  }

  async logOutClientOperations(
    grpcSdk: ConduitGrpcSdk,
    clientConfig: { multipleUserSessions: boolean; multipleClientLogins: boolean },
    authToken: string,
    clientId: string,
    userId: string,
  ) {
    const isAnonymous = 'anonymous-client' === clientId;
    const token = authToken.split(' ')[1];
    if (!clientConfig.multipleUserSessions) {
      await this.deleteUserTokens({
        clientId: !isAnonymous && clientConfig.multipleClientLogins ? clientId : null,
        user: userId,
      });
    } else if (clientConfig.multipleUserSessions || clientConfig.multipleClientLogins) {
      await this.deleteUserTokens({
        token: token,
      });
    }
  }

  deleteUserTokens(query: Query) {
    const promise1 = AccessToken.getInstance().deleteMany(query);
    const promise2 = RefreshToken.getInstance().deleteMany(query);

    return Promise.all([promise1, promise2]);
  }
}
