import { ConduitGrpcSdk, Indexable, Query } from '@conduitplatform/grpc-sdk';
import { AccessToken, RefreshToken, User } from '../models/index.js';
import moment from 'moment';
import { AuthUtils } from '../utils/index.js';
import jwt, { SignOptions } from 'jsonwebtoken';
import { Config } from '../config/index.js';
import { isNil } from 'lodash-es';
import { Cookie } from '../interfaces/index.js';
import {
  assertRealmAccess,
  assertRealmId,
  getRealmSlugById,
  realmsEnabled,
  shouldCheckRealmAccess,
  tokenAssurance,
} from '../utils/realm.js';

export interface TokenOptions {
  user: User;
  clientId: string;
  config: Config;
  twoFaPass?: boolean;
  isRefresh?: boolean;
  noSudo?: boolean;
  /**
   * The realm **team id** (not the slug) the session is issued in. Omitted/null/empty =
   * global. A value that is not id-shaped is a programming error (INVALID_ARGUMENT).
   */
  realm?: string | null;
}

export class TokenProvider {
  private static _instance: TokenProvider;

  private constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  public static getInstance(grpcSdk?: ConduitGrpcSdk) {
    if (TokenProvider._instance) return TokenProvider._instance;
    if (!grpcSdk) throw new Error('GrpcSdk not provided');
    return (TokenProvider._instance = new TokenProvider(grpcSdk));
  }

  async provideUserTokens(tokenOptions: TokenOptions, redirectUrl?: string) {
    // Before signInClientOperations: it deletes the user's existing tokens, and a denied
    // realm entry must not log the user out of the client.
    await this.assertRealmAccessForTokens(tokenOptions);
    await this.signInClientOperations(
      this.grpcSdk,
      tokenOptions.config.clients,
      tokenOptions.user._id,
      tokenOptions.clientId,
    );
    const [accessToken, refreshToken] = await this.createUserTokens(tokenOptions, true);
    this.trackLoggedInUserMetric(tokenOptions, accessToken);
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
          redirect: redirectUrlWithParams.toString(),
          setCookies: Object.values(cookies).map(obj => obj),
        };
      } else {
        return {
          result: {
            accessToken: cookies.accessToken ? undefined : accessToken.token,
            refreshToken: cookies.refreshToken ? undefined : refreshToken?.token,
          },
          setCookies: Object.values(cookies).map(obj => obj),
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
        redirect: redirectUrlWithParams.toString(),
      };
    } else {
      return {
        accessToken: accessToken.token,
        refreshToken: refreshToken?.token,
      };
    }
  }

  // used only for the login grpc call
  async provideUserTokensInternal(tokenOptions: TokenOptions) {
    // do not escalate user permissions when created internally
    const internalTokenOptions = {
      ...tokenOptions,
      twoFaPass: true,
      noSudo: false,
    };

    await this.assertRealmAccessForTokens(internalTokenOptions);
    const [accessToken, refreshToken] = await this.createUserTokens(
      internalTokenOptions,
      true,
    );

    this.trackLoggedInUserMetric(internalTokenOptions, accessToken);

    return {
      userId: tokenOptions.user._id.toString(),
      accessToken: accessToken.token,
      refreshToken: refreshToken?.token,
    };
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
        ...(isAnonymous || !clientConfig.multipleClientLogins ? {} : { clientId }),
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
    if (!clientConfig.multipleUserSessions) {
      await this.deleteUserTokens({
        ...(!isAnonymous && clientConfig.multipleClientLogins ? { clientId } : {}),
        user: userId,
      });
    } else if (clientConfig.multipleUserSessions || clientConfig.multipleClientLogins) {
      const accessToken = await AccessToken.getInstance().findOne(
        { token: authToken },
        { readPreference: 'primary' },
      );
      if (accessToken) {
        await AccessToken.getInstance().deleteOne({ token: authToken });
        await RefreshToken.getInstance().deleteOne({ accessToken: accessToken._id });
      }
    }
  }

  deleteUserTokens(query: Query<AccessToken>) {
    const promise1 = AccessToken.getInstance().deleteMany(query);
    const promise2 = RefreshToken.getInstance().deleteMany(query as Query<RefreshToken>);

    return Promise.all([promise1, promise2]);
  }

  private async trackLoggedInUserMetric(
    tokenOptions: TokenOptions,
    accessToken: AccessToken,
  ) {
    try {
      const authorized =
        !tokenOptions.user.hasTwoFA ||
        tokenOptions.isRefresh ||
        (tokenOptions.user.hasTwoFA && tokenOptions.twoFaPass);

      if (!authorized) return;

      await AuthUtils.addLoggedInUser(tokenOptions.user._id, accessToken.expiresOn);
      await AuthUtils.reconcileLoggedInUsersMetric();
    } catch (err) {
      ConduitGrpcSdk.Logger.warn('Logged-in user metric tracking failed');
      ConduitGrpcSdk.Logger.warn((err as Error).message);
    }
  }
  public trackLoggedOutUserMetric(userId: string) {
    this.removeLoggedInUserMetric(userId);
  }

  private async removeLoggedInUserMetric(userId: string) {
    try {
      await AuthUtils.removeLoggedInUser(userId);
      await AuthUtils.reconcileLoggedInUsersMetric();
    } catch (err) {
      ConduitGrpcSdk.Logger.warn('Logged-in user metric cleanup failed');
      ConduitGrpcSdk.Logger.warn((err as Error).message);
    }
  }
  /**
   * Realm access backstop for every token issuance path. Callers run it first (before
   * any side effect); `createUserTokens` runs it again only when it was not done yet.
   * Skipped when realms are disabled, or when both the requested realm and the user's
   * home realm are empty. A partial token (2FA pending) is evaluated with
   * `tokenAssurance`.
   */
  private async assertRealmAccessForTokens(tokenOptions: TokenOptions): Promise<void> {
    const requestedRealm = tokenOptions.realm ? assertRealmId(tokenOptions.realm) : null;
    const homeRealm = tokenOptions.user.homeRealm
      ? String(tokenOptions.user.homeRealm)
      : null;
    if (
      !shouldCheckRealmAccess({
        realmsEnabled: realmsEnabled(),
        realm: requestedRealm,
        homeRealm,
      })
    ) {
      return;
    }
    const { realmAuthorized } = tokenAssurance({
      hasTwoFA: !!tokenOptions.user.hasTwoFA,
      twoFaPass: tokenOptions.twoFaPass,
      isRefresh: tokenOptions.isRefresh,
    });
    await assertRealmAccess({
      user: tokenOptions.user,
      requestedRealm,
      authorized: realmAuthorized,
      clientId: tokenOptions.clientId,
    });
  }

  private async createUserTokens(
    tokenOptions: TokenOptions,
    realmChecked = false,
  ): Promise<[AccessToken, RefreshToken?]> {
    if (!tokenOptions.user.active) {
      throw new Error('User is blocked or deleted');
    }
    // guard for direct callers that did not run the check up front
    if (!realmChecked) await this.assertRealmAccessForTokens(tokenOptions);
    const signTokenOptions: SignOptions = {
      expiresIn: (tokenOptions.config.accessTokens.expiryPeriod as number) / 1000,
    };
    const { authorized } = tokenAssurance({
      hasTwoFA: !!tokenOptions.user.hasTwoFA,
      twoFaPass: tokenOptions.twoFaPass,
      isRefresh: tokenOptions.isRefresh,
    });
    // to activate sudo, a user needs to have passed 2fa (if applicable)
    // the tokens should not be created during the refresh token flow
    // and the noSudo flag needs to be false or not set
    const sudo = authorized && !tokenOptions.isRefresh && !tokenOptions.noSudo;

    // Realm access was verified above; only the token's realm claims are resolved here.
    let realm: string | undefined;
    let realmSlug: string | undefined;
    let homeSlug: string | undefined;
    const requestedRealm = tokenOptions.realm ? String(tokenOptions.realm) : null;
    const homeRealm = tokenOptions.user.homeRealm
      ? String(tokenOptions.user.homeRealm)
      : null;
    if (
      shouldCheckRealmAccess({
        realmsEnabled: realmsEnabled(),
        realm: requestedRealm,
        homeRealm,
      })
    ) {
      realm = requestedRealm ?? undefined;
      realmSlug = await getRealmSlugById(requestedRealm);
      homeSlug = await getRealmSlugById(homeRealm);
    }

    const accessToken = await AccessToken.getInstance().create({
      user: tokenOptions.user._id,
      clientId: tokenOptions.clientId,
      ...(realm ? { realm } : {}),
      token: this.signToken(
        {
          id: tokenOptions.user._id,
          authorized,
          sudo,
          realm: realmSlug,
          home: homeSlug,
        },
        tokenOptions.config.accessTokens.jwtSecret,
        signTokenOptions,
      ),
      expiresOn: moment
        .utc()
        .add(tokenOptions.config.accessTokens.expiryPeriod as number, 'milliseconds')
        .toDate(),
    });

    let refreshToken;
    if (tokenOptions.config.refreshTokens.enabled && authorized) {
      refreshToken = await RefreshToken.getInstance().create({
        user: tokenOptions.user._id,
        clientId: tokenOptions.clientId,
        ...(realm ? { realm } : {}),
        token: AuthUtils.randomToken(),
        accessToken: accessToken._id,
        expiresOn: moment
          .utc()
          .add(tokenOptions.config.refreshTokens.expiryPeriod as number, 'milliseconds')
          .toDate(),
      });
    }
    return [accessToken, refreshToken];
  }

  private constructCookies(
    tokenOptions: TokenOptions,
    tokens: [AccessToken, RefreshToken?],
  ) {
    const cookies: { accessToken?: Cookie; refreshToken?: Cookie } = {};
    if (tokenOptions.config.accessTokens.setCookie) {
      const cookieOptions = tokenOptions.config.accessTokens.cookieOptions;
      cookies.accessToken = {
        name: 'accessToken',
        value: (tokens[0] as AccessToken).token,
        options: {
          ...cookieOptions,
          maxAge: tokenOptions.config.accessTokens.expiryPeriod / 1000,
        },
      };
    }
    if (!isNil(tokens[1]) && tokenOptions.config.refreshTokens.setCookie) {
      if (!isNil(tokens[1].token)) {
        const cookieOptions = tokenOptions.config.refreshTokens.cookieOptions;
        cookies.refreshToken = {
          name: 'refreshToken',
          value: (tokens[1] as RefreshToken).token,
          options: {
            ...cookieOptions,
            maxAge: tokenOptions.config.refreshTokens.expiryPeriod / 1000,
          },
        };
      }
    }
    return cookies;
  }

  private signToken(data: Indexable, secret: string, options: SignOptions) {
    return jwt.sign(data, secret, { ...options, algorithm: 'HS256' });
  }
}
