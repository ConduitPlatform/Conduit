import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
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
}

export class TokenProvider {
  private static _instance: TokenProvider;

  private constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  public static getInstance(grpcSdk?: ConduitGrpcSdk) {
    if (TokenProvider._instance) return TokenProvider._instance;
    if (!grpcSdk) throw new Error('GrpcSdk not provided');
    TokenProvider._instance = new TokenProvider(grpcSdk);
  }

  private createUserTokens(
    tokenOptions: TokenOptions,
  ): Promise<[AccessToken, RefreshToken?]> {
    const signTokenOptions: ISignTokenOptions = {
      secret: tokenOptions.config.accessTokens.jwtSecret,
      expiresIn: tokenOptions.config.accessTokens.expiryPeriod,
    };

    const accessTokenPromise = AccessToken.getInstance().create({
      userId: tokenOptions.user._id,
      clientId: tokenOptions.clientId,
      token: this.signToken({ id: tokenOptions.user._id }, signTokenOptions),
      expiresOn: moment()
        .add(tokenOptions.config.accessTokens.expiryPeriod as number, 'milliseconds')
        .toDate(),
    });
    let promises: [
      accesstoken: Promise<AccessToken>,
      refreshToken?: Promise<RefreshToken>,
    ] = [accessTokenPromise];
    let refreshTokenPromise;
    if (tokenOptions.config.refreshTokens.enabled) {
      refreshTokenPromise = RefreshToken.getInstance().create({
        userId: tokenOptions.user._id,
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
    let cookies: Cookie[] = [];
    if (tokenOptions.config.accessTokens.setCookie) {
      const cookieOptions = {
        ...tokenOptions.config.cookieOptions,
        ...tokenOptions.config.accessTokens.cookieOptions,
      };
      cookies.push({
        name: 'accessToken',
        value: (tokens[0] as AccessToken).token,
        options: cookieOptions,
      });
    }
    if (
      !isNil((tokens[1] as RefreshToken).token) &&
      tokenOptions.config.refreshTokens.setCookie
    ) {
      const cookieOptions = {
        ...tokenOptions.config.cookieOptions,
        ...tokenOptions.config.refreshTokens.cookieOptions,
      };
      cookies.push({
        name: 'refreshToken',
        value: (tokens[1] as RefreshToken).token,
        options: cookieOptions,
      });
    }
    return cookies;
  }

  async provideUserTokens(tokenOptions: TokenOptions, redirectUrl?: string) {
    await AuthUtils.signInClientOperations(
      this.grpcSdk,
      tokenOptions.config.clients,
      tokenOptions.user._id,
      tokenOptions.clientId,
    );
    const [accessToken, refreshToken] = await this.createUserTokens(tokenOptions);
    let cookies: Cookie[] = this.constructCookies(tokenOptions, [
      accessToken,
      refreshToken,
    ]);
    if (cookies.length > 0) {
      if (redirectUrl) {
        let redirectUrlWithParams = new URL(redirectUrl);
        if (!tokenOptions.config.accessTokens.setCookie) {
          redirectUrlWithParams.searchParams.append('accessToken', accessToken.token);
        }
        if (
          tokenOptions.config.refreshTokens.enabled &&
          !tokenOptions.config.refreshTokens.setCookie
        ) {
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
            accessToken: tokenOptions.config.accessTokens.setCookie
              ? undefined
              : accessToken.token,
            refreshToken: tokenOptions.config.refreshTokens.setCookie
              ? undefined
              : refreshToken?.token,
          },
          setCookies: cookies,
        };
      }
    }
    if (redirectUrl) {
      let redirectUrlWithParams = new URL(redirectUrl);
      redirectUrlWithParams.searchParams.append('accessToken', accessToken.token);
      if (tokenOptions.config.refreshTokens.enabled) {
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
    const [accessToken, refreshToken] = await this.createUserTokens(tokenOptions);
    return {
      userId: tokenOptions.user._id.toString(),
      accessToken: accessToken.token,
      refreshToken: refreshToken?.token,
    };
  }

  private signToken(data: { [key: string]: any }, options: ISignTokenOptions) {
    const { secret, expiresIn } = options;
    return jwt.sign(data, secret, { expiresIn });
  }
}
