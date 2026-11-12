import { ConduitGrpcSdk, Indexable, Query } from '@conduitplatform/grpc-sdk';
import { authErrors, ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';
import { AccessToken, RealmMembership, RefreshToken, User } from '../models/index.js';
import moment from 'moment';
import { AuthUtils } from '../utils/index.js';
import jwt, { SignOptions } from 'jsonwebtoken';
import { createSigner } from 'fast-jwt';
import { v4 as uuid } from 'uuid';
import { Config } from '../config/index.js';
import { isNil } from 'lodash-es';
import {
  hashRefreshToken,
  initialRefreshExpiry,
  refreshMaxExpiresOn,
} from '../utils/refreshToken.logic.js';
import { Cookie } from '../interfaces/index.js';
import { buildAccessTokenClaims, isSyntheticSid } from './tokenClaims.logic.js';
import { loadTeamClaims } from '../utils/teamClaims.js';
import { deleteSessionTokens } from '../utils/sessionRevocation.js';
import {
  getSessionRegistry,
  indexUserSession,
  revokeSessions,
} from '../utils/sessionServices.js';
import {
  assertRealmAccess,
  assertRealmId,
  getRealmSlugById,
  realmsEnabled,
  resolveRefreshPolicyForRealm,
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

/** A freshly minted refresh token: the row plus the one-time plaintext. */
export type IssuedRefreshToken = RefreshToken & { token: string };

/**
 * A minted access token: the AccessToken row in session mode, only the signed token and
 * its expiry in jwt mode (no row exists).
 */
export type MintedAccessToken = Pick<AccessToken, 'token' | 'expiresOn'> & {
  _id?: string;
};

type RealmClaims = { realm?: string; realmSlug?: string; homeSlug?: string };

type JwtSigner = (payload: object) => string;

const signers = new Map<string, JwtSigner>();

function jwtSigner(kid: string, privateKey: string) {
  const cacheKey = `${kid}\n${privateKey}`;
  let signer = signers.get(cacheKey);
  if (!signer) {
    if (signers.size >= 4) signers.clear();
    signer = createSigner({
      algorithm: 'EdDSA',
      key: privateKey,
      kid,
    }) as unknown as JwtSigner;
    signers.set(cacheKey, signer);
  }
  return signer;
}

export const isJwtAccessMode = (config: Config) => config.accessTokens.mode === 'jwt';

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
    this.trackLoggedInUserMetric(
      tokenOptions,
      this.sessionExpiry(tokenOptions, accessToken, refreshToken),
    );
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

    this.trackLoggedInUserMetric(
      internalTokenOptions,
      this.sessionExpiry(internalTokenOptions, accessToken, refreshToken),
    );

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
        const sessionIds = new Set<string>();
        const linked = await RefreshToken.getInstance().findOne(
          { accessToken: accessToken._id },
          { select: '_id', readPreference: 'primary' },
        );
        if (linked) sessionIds.add(String(linked._id));
        await AccessToken.getInstance().deleteOne({ token: authToken });
        await RefreshToken.getInstance().deleteOne({ accessToken: accessToken._id });
        // sudo (and renewed) tokens carry the session they belong to
        if (accessToken.session) {
          sessionIds.add(String(accessToken.session));
          await RefreshToken.getInstance().deleteOne({
            _id: String(accessToken.session),
            user: userId,
          });
        }
        await revokeSessions(Array.from(sessionIds), 'logout');
      }
    }
  }

  /**
   * A revocation sweep: deletes the matching access and refresh tokens and revokes the
   * affected sessions in the registry (ids are read before the delete).
   */
  deleteUserTokens(query: Query<AccessToken>) {
    return deleteSessionTokens(query);
  }

  /**
   * When the session ends, for the logged-in users metric: in jwt mode the refresh
   * token's expiry (the access token's without a refresh token), in session mode the
   * access token's.
   */
  private sessionExpiry(
    tokenOptions: TokenOptions,
    accessToken: MintedAccessToken,
    refreshToken?: Pick<RefreshToken, 'expiresOn'>,
  ): Date {
    if (isJwtAccessMode(tokenOptions.config) && refreshToken) {
      return new Date(refreshToken.expiresOn);
    }
    return accessToken.expiresOn;
  }

  private async trackLoggedInUserMetric(tokenOptions: TokenOptions, expiresOn: Date) {
    try {
      const authorized =
        !tokenOptions.user.hasTwoFA ||
        tokenOptions.isRefresh ||
        (tokenOptions.user.hasTwoFA && tokenOptions.twoFaPass);

      if (!authorized) return;

      await AuthUtils.addLoggedInUser(tokenOptions.user._id, expiresOn);
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
  ): Promise<[MintedAccessToken, IssuedRefreshToken?]> {
    if (!tokenOptions.user.active) {
      throw new ModuleError(authErrors.USER_BLOCKED);
    }
    // guard for direct callers that did not run the check up front
    if (!realmChecked) await this.assertRealmAccessForTokens(tokenOptions);
    const { authorized } = tokenAssurance({
      hasTwoFA: !!tokenOptions.user.hasTwoFA,
      twoFaPass: tokenOptions.twoFaPass,
      isRefresh: tokenOptions.isRefresh,
    });
    // to activate sudo, a user needs to have passed 2fa (if applicable)
    // the tokens should not be created during the refresh token flow
    // and the noSudo flag needs to be false or not set
    const sudo = authorized && !tokenOptions.isRefresh && !tokenOptions.noSudo;

    if (isJwtAccessMode(tokenOptions.config)) {
      return this.createJwtUserTokens(tokenOptions, { authorized, sudo });
    }

    const { accessToken, realm } = await this.createAccessToken(tokenOptions, {
      authorized,
      sudo,
    });

    let refreshToken: IssuedRefreshToken | undefined;
    if (tokenOptions.config.refreshTokens.enabled && authorized) {
      refreshToken = await this.createRefreshRow(tokenOptions, realm, accessToken._id);
      // session link: logging out through this access token ends the session
      await AccessToken.getInstance().findByIdAndUpdate(accessToken._id, {
        session: refreshToken._id,
      });
      await this.registerSession(refreshToken._id, tokenOptions, realm, {
        ttlMs: new Date(refreshToken.expiresOn).getTime() - Date.now(),
      });
    }
    return [accessToken, refreshToken];
  }

  /**
   * Creates the refresh token row (hash only: the plaintext exists in the returned object
   * and the response). `accessToken` links the session-mode access token row; jwt mode
   * has none.
   */
  private async createRefreshRow(
    tokenOptions: TokenOptions,
    realm: string | undefined,
    accessTokenId?: string,
  ): Promise<IssuedRefreshToken> {
    const policy = await resolveRefreshPolicyForRealm(realm, tokenOptions.config);
    const issuedAt = moment.utc().toDate();
    const plaintext = AuthUtils.randomToken();
    const row = await RefreshToken.getInstance().create({
      user: tokenOptions.user._id,
      clientId: tokenOptions.clientId,
      ...(realm ? { realm } : {}),
      tokenHash: hashRefreshToken(plaintext),
      ...(accessTokenId ? { accessToken: accessTokenId } : {}),
      issuedAt,
      extendable: policy.extendable,
      maxExpiresOn: refreshMaxExpiresOn(issuedAt, policy.maxLifetime),
      expiresOn: initialRefreshExpiry(issuedAt, policy.expiryPeriod, policy.maxLifetime),
    });
    return Object.assign(row, { token: plaintext });
  }

  /**
   * Registers a session in the registry. The sid is the refresh row id, or (jwt mode
   * without a refresh row) a fresh uuid that lives as long as the access token.
   * With `strictRevocation` a failure is fatal (a token the registry does not know is
   * rejected on every request); otherwise it is logged.
   */
  private async registerSession(
    sid: string,
    tokenOptions: TokenOptions,
    realm: string | undefined,
    params: { ttlMs: number },
  ): Promise<void> {
    try {
      const registry = getSessionRegistry();
      if (!registry) throw new Error('Session registry unavailable');
      await registry.register(
        String(sid),
        {
          user: String(tokenOptions.user._id),
          clientId: tokenOptions.clientId,
          realm: realm ?? null,
        },
        Math.max(1, params.ttlMs),
      );
      // a session without a refresh row can only be swept through the per-user index
      if (isSyntheticSid(sid)) {
        await indexUserSession(String(tokenOptions.user._id), String(sid), params.ttlMs);
      }
    } catch (e) {
      if (
        isJwtAccessMode(tokenOptions.config) &&
        tokenOptions.config.accessTokens.strictRevocation
      ) {
        throw new ModuleError(
          authErrors.SESSION_REGISTRY_UNAVAILABLE,
          (e as Error)?.message ?? String(e),
        );
      }
      ConduitGrpcSdk.Logger.warn(
        `Session registry registration failed: ${(e as Error)?.message ?? e}`,
      );
    }
  }

  /**
   * jwt mode: the session id is the refresh row id when one is created (stable across
   * renews), otherwise a fresh uuid registered for the access token lifetime (also for a
   * 2FA-pending token, which strict revocation checks on the 2FA routes).
   */
  private async createJwtUserTokens(
    tokenOptions: TokenOptions,
    claims: { authorized: boolean; sudo: boolean },
  ): Promise<[MintedAccessToken, IssuedRefreshToken?]> {
    const realmClaims = await this.resolveRealmClaims(tokenOptions);
    let refreshToken: IssuedRefreshToken | undefined;
    let sid: string;
    let ttlMs: number;
    if (tokenOptions.config.refreshTokens.enabled && claims.authorized) {
      refreshToken = await this.createRefreshRow(tokenOptions, realmClaims.realm);
      sid = String(refreshToken._id);
      ttlMs = new Date(refreshToken.expiresOn).getTime() - Date.now();
    } else {
      sid = uuid();
      ttlMs = tokenOptions.config.accessTokens.expiryPeriod as number;
    }
    try {
      const accessToken = await this.signJwtAccessToken(
        tokenOptions,
        claims,
        sid,
        realmClaims,
      );
      await this.registerSession(sid, tokenOptions, realmClaims.realm, { ttlMs });
      return [accessToken, refreshToken];
    } catch (e) {
      // no half-created session: a refresh token whose access token never left
      if (refreshToken) {
        await RefreshToken.getInstance()
          .deleteOne({ _id: refreshToken._id })
          .catch(() => undefined);
      }
      throw e;
    }
  }

  /** Realm, realm slug and home realm slug of the session (realm access already checked). */
  private async resolveRealmClaims(tokenOptions: TokenOptions): Promise<RealmClaims> {
    const requestedRealm = tokenOptions.realm ? String(tokenOptions.realm) : null;
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
      return {};
    }
    return {
      realm: requestedRealm ?? undefined,
      realmSlug: await getRealmSlugById(requestedRealm),
      homeSlug: await getRealmSlugById(homeRealm),
    };
  }

  private async hasGuestMembership(user: User, realm: string | undefined) {
    if (!realm || (user.homeRealm && String(user.homeRealm) === realm)) return false;
    const membership = await RealmMembership.getInstance().findOne(
      { user: String(user._id), realm },
      { readPreference: 'primary' },
    );
    return membership?.membershipType === 'guest';
  }

  /** Signs an EdDSA access token carrying the claims of AccessTokenClaims. */
  private async signJwtAccessToken(
    tokenOptions: TokenOptions,
    claims: { authorized: boolean; sudo: boolean },
    sid: string,
    realmClaims: RealmClaims,
  ): Promise<MintedAccessToken> {
    const { accessTokens } = tokenOptions.config;
    const { kid, privateKey } = accessTokens.signing;
    if (!kid || !privateKey) {
      throw new ModuleError(errors.SIGNING_KEYS_UNAVAILABLE);
    }
    const userId = String(tokenOptions.user._id);
    const [teams, hasGuestMembership] = await Promise.all([
      // without the teams feature there is nothing to claim (and nothing to look up)
      tokenOptions.config.teams?.enabled
        ? loadTeamClaims(userId, {
            findRelations: async request => {
              if (!this.grpcSdk.isAvailable('authorization')) {
                throw new ModuleError(errors.AUTHORIZATION_UNAVAILABLE);
              }
              return this.grpcSdk.authorization!.findRelation(request);
            },
          })
        : undefined,
      this.hasGuestMembership(tokenOptions.user, realmClaims.realm),
    ]);
    const now = Date.now();
    const expiryMs = accessTokens.expiryPeriod as number;
    const payload = buildAccessTokenClaims({
      userId,
      sessionId: sid,
      clientId: tokenOptions.clientId,
      realmId: realmClaims.realm,
      realmSlug: realmClaims.realmSlug,
      homeSlug: realmClaims.homeSlug,
      homeRealm: tokenOptions.user.homeRealm ? String(tokenOptions.user.homeRealm) : null,
      hasGuestMembership,
      authorized: claims.authorized,
      sudo: claims.sudo,
      tokenVersion: accessTokens.tokenVersion,
      teams,
      now,
      expiryMs,
    });
    return {
      token: jwtSigner(kid, privateKey)(payload),
      expiresOn: new Date(payload.exp * 1000),
    };
  }

  /**
   * Signs and registers one session-mode access token. Realm access must already be
   * verified; only the token's realm claims are resolved here.
   */
  private async createAccessToken(
    tokenOptions: TokenOptions,
    claims: { authorized: boolean; sudo: boolean },
    session?: string,
  ): Promise<{ accessToken: AccessToken; realm?: string }> {
    const signTokenOptions: SignOptions = {
      expiresIn: (tokenOptions.config.accessTokens.expiryPeriod as number) / 1000,
    };
    const { realm, realmSlug, homeSlug } = await this.resolveRealmClaims(tokenOptions);

    const accessToken = await AccessToken.getInstance().create({
      user: tokenOptions.user._id,
      clientId: tokenOptions.clientId,
      ...(realm ? { realm } : {}),
      ...(session ? { session } : {}),
      token: this.signToken(
        {
          id: tokenOptions.user._id,
          authorized: claims.authorized,
          sudo: claims.sudo,
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
    return { accessToken, realm };
  }

  /**
   * Refresh flow (`/renew`): mints only a new access token for an existing refresh token.
   * The refresh token is neither rotated nor deleted. In session mode the previous access
   * token row linked to it is removed and the new one is linked; in jwt mode the new token
   * carries the same session id (the refresh row id) and nothing is stored.
   */
  async provideRenewedAccessToken(
    tokenOptions: Omit<TokenOptions, 'isRefresh' | 'twoFaPass'>,
    refreshToken: Pick<RefreshToken, '_id' | 'accessToken' | 'expiresOn'>,
    presentedRefreshToken?: string,
  ) {
    const options: TokenOptions = { ...tokenOptions, isRefresh: true, twoFaPass: true };
    await this.assertRealmAccessForTokens(options);
    if (!options.user.active) {
      throw new ModuleError(authErrors.USER_BLOCKED);
    }
    let accessToken: MintedAccessToken;
    if (isJwtAccessMode(options.config)) {
      const realmClaims = await this.resolveRealmClaims(options);
      accessToken = await this.signJwtAccessToken(
        options,
        { authorized: true, sudo: false },
        String(refreshToken._id),
        realmClaims,
      );
      // heals a registry entry lost to a Redis flush or failover: the live refresh row
      // proves the session is valid (sweeps delete rows before they revoke)
      await this.registerSession(String(refreshToken._id), options, realmClaims.realm, {
        ttlMs: new Date(refreshToken.expiresOn).getTime() - Date.now(),
      });
      // a sweep that ran between the row check and the registration must win
      const stillThere = await RefreshToken.getInstance().findOne(
        { _id: String(refreshToken._id) },
        { select: '_id', readPreference: 'primary' },
      );
      if (!stillThere) {
        await revokeSessions([String(refreshToken._id)], 'renew raced a sweep');
        throw new ModuleError(errors.REFRESH_TOKEN_INVALID, 'renew raced a sweep');
      }
    } else {
      let sessionRealm: string | undefined;
      ({ accessToken, realm: sessionRealm } = await this.createAccessToken(
        options,
        { authorized: true, sudo: false },
        String(refreshToken._id),
      ));
      // heals a registry entry lost to a Redis flush or failover (same as jwt mode)
      await this.registerSession(String(refreshToken._id), options, sessionRealm, {
        ttlMs: new Date(refreshToken.expiresOn).getTime() - Date.now(),
      });
      if (refreshToken.accessToken) {
        await AccessToken.getInstance().deleteOne({
          _id: String(
            (refreshToken.accessToken as AccessToken)._id ?? refreshToken.accessToken,
          ),
        });
      }
      await RefreshToken.getInstance().findByIdAndUpdate(refreshToken._id, {
        accessToken: accessToken._id,
      });
    }
    this.trackLoggedInUserMetric(
      options,
      this.sessionExpiry(options, accessToken, refreshToken),
    );
    const cookies = this.constructCookies(options, [accessToken]);
    // `refreshToken` is the presented token, unchanged (clients may ignore it); it is
    // left out when it travels as a cookie
    const echoed = options.config.refreshTokens.setCookie
      ? undefined
      : presentedRefreshToken;
    if (cookies.accessToken) {
      return {
        result: { accessToken: undefined, refreshToken: echoed },
        setCookies: [cookies.accessToken],
      };
    }
    return { accessToken: accessToken.token, refreshToken: echoed };
  }

  /**
   * Step-up (`/sudo`): an access token with sudo, issued after the caller re-proved
   * the password or a 2FA code. No refresh token is created and the client's existing
   * sessions are left alone (no signInClientOperations). In jwt mode the token keeps the
   * presenting session id (a fresh registered uuid when there is none).
   */
  async provideSudoAccessToken(options: {
    user: User;
    clientId: string;
    config: Config;
    realm?: string | null;
    /** session (refresh token id) of the presenting access token, if any */
    sessionId?: string | null;
  }): Promise<{ accessToken: string }> {
    const { sessionId, ...rest } = options;
    const tokenOptions: TokenOptions = {
      ...rest,
      twoFaPass: true,
      isRefresh: false,
    };
    if (!tokenOptions.user.active) {
      throw new ModuleError(authErrors.USER_BLOCKED);
    }
    await this.assertRealmAccessForTokens(tokenOptions);
    if (isJwtAccessMode(tokenOptions.config)) {
      const realmClaims = await this.resolveRealmClaims(tokenOptions);
      const sid = sessionId ? String(sessionId) : uuid();
      const accessToken = await this.signJwtAccessToken(
        tokenOptions,
        { authorized: true, sudo: true },
        sid,
        realmClaims,
      );
      const accessTtlMs = tokenOptions.config.accessTokens.expiryPeriod as number;
      if (!sessionId) {
        await this.registerSession(sid, tokenOptions, realmClaims.realm, {
          ttlMs: accessTtlMs,
        });
      } else if (isSyntheticSid(sid)) {
        // the new token outlives the entry of the session it reuses: extend (never
        // register: a revoked session must stay revoked). Refresh row sessions live as
        // long as their row, so their entries are left alone.
        try {
          await getSessionRegistry()?.touch(sid, accessTtlMs);
          await indexUserSession(String(tokenOptions.user._id), sid, accessTtlMs);
        } catch (e) {
          ConduitGrpcSdk.Logger.warn(
            `Session registry touch failed: ${(e as Error)?.message ?? e}`,
          );
        }
      }
      return { accessToken: accessToken.token };
    }
    const { accessToken } = await this.createAccessToken(
      tokenOptions,
      { authorized: true, sudo: true },
      sessionId ? String(sessionId) : undefined,
    );
    return { accessToken: accessToken.token };
  }

  private constructCookies(
    tokenOptions: TokenOptions,
    tokens: [MintedAccessToken, IssuedRefreshToken?],
  ) {
    const cookies: { accessToken?: Cookie; refreshToken?: Cookie } = {};
    if (tokenOptions.config.accessTokens.setCookie) {
      const cookieOptions = tokenOptions.config.accessTokens.cookieOptions;
      cookies.accessToken = {
        name: 'accessToken',
        value: tokens[0].token,
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
          value: tokens[1].token,
          options: {
            ...cookieOptions,
            maxAge: Math.max(
              0,
              Math.floor((new Date(tokens[1].expiresOn).getTime() - Date.now()) / 1000),
            ),
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
