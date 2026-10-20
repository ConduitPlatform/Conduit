import { GrpcError, Indexable } from '@conduitplatform/grpc-sdk';
import { randomBytes } from 'crypto';
import {
  ConduitBoolean,
  ConduitString,
  ConfigController,
  ModuleError,
} from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { TokenType } from '../constants/index.js';
import { errors } from '../errors.js';
import { Token, User } from '../models/index.js';
import { hasConduitCode } from '../utils/common.logic.js';
import { AuthUtils } from '../utils/index.js';
import {
  realmsEnabled,
  RealmContext,
  RealmOAuthProviderKey,
  resolveRealmById,
} from '../utils/realm.js';
import { isGlobalStrategyEnabled, isStrategyEnabled } from './realmRequest.logic.js';
import {
  assertDiscoveryRequestAllowed,
  buildDiscoveryAnswer,
  DISCOVERY_MAX_ACCOUNTS,
  DISCOVERY_PASSWORD_MAX_ACCOUNTS,
  DiscoveryAccount,
  DiscoveryAnswer,
  isDiscoveryAccepted,
  isLinkProofLive,
  isProofConsumed,
  linkProofData,
  oauthAccountLinking,
  oauthAccountListed,
  oauthAccountMatch,
  oauthDiscoveryFilter,
} from './realmDiscovery.logic.js';

export * from './realmDiscovery.logic.js';

/**
 * The fields a login route adds to its return definition when it can answer a discovery
 * (`realms` and `proofToken`, see realmDiscovery.logic.ts).
 */
export const DISCOVERY_RESPONSE_FIELDS = {
  realms: [
    {
      slug: ConduitString.Optional,
      name: ConduitString.Optional,
      requiresTwoFa: ConduitBoolean.Optional,
    },
  ],
  proofToken: ConduitString.Optional,
};

/** Whether the discovery login is on: realms enabled and `teams.realms.discoveryLogin`. */
export function discoveryEnabled(): boolean {
  return (
    realmsEnabled() &&
    ConfigController.getInstance().config.teams.realms.discoveryLogin === true
  );
}

/** Throws INVALID_ARGUMENT when a request with `discover` may not run. */
export function assertDiscoveryAllowed(params: {
  discover: boolean;
  realm?: unknown;
  invitationToken?: unknown;
}): void {
  assertDiscoveryRequestAllowed({ ...params, enabled: discoveryEnabled() });
}

type HomeContext = { ok: true; ctx: RealmContext | null } | { ok: false };

/**
 * The home realm of an account, read for the discovery rules. A global account has none
 * (null). A home realm that is missing or inactive does not list its accounts (`ok: false`).
 */
async function homeContextOf(user: Pick<User, 'homeRealm'>): Promise<HomeContext> {
  if (!user.homeRealm) return { ok: true, ctx: null };
  try {
    return { ok: true, ctx: await resolveRealmById(String(user.homeRealm)) };
  } catch (err) {
    if (hasConduitCode(err, errors.REALM_NOT_FOUND)) return { ok: false };
    throw err;
  }
}

/** Whether the strategy is enabled where the account lives (its home realm, or global). */
function strategyEnabledAtHome(ctx: RealmContext | null, strategyKey: string): boolean {
  if (ctx) return isStrategyEnabled(ctx.effective, strategyKey);
  return isGlobalStrategyEnabled(ConfigController.getInstance().config, strategyKey);
}

function accountOf(
  user: Pick<User, '_id' | 'hasTwoFA'>,
  ctx: RealmContext | null,
): DiscoveryAccount {
  return {
    userId: String(user._id),
    realmId: ctx ? String(ctx.team._id) : null,
    slug: ctx ? (ctx.team.realm?.slug ?? null) : null,
    name: ctx ? (ctx.team.name ?? null) : null,
    hasTwoFA: user.hasTwoFA === true,
  };
}

/**
 * Lists the realms of the accounts a proof was given for (no password involved), and issues
 * the proof token for the ones without 2FA, bound to `clientId`. An answer without accounts
 * has no proof token.
 */
export async function issueDiscoveryAnswer(
  accounts: DiscoveryAccount[],
  clientId: string,
): Promise<DiscoveryAnswer> {
  const { realms, proofEntries } = buildDiscoveryAnswer(accounts);
  if (proofEntries.length === 0) return { realms };
  const token = await Token.getInstance().create({
    tokenType: TokenType.REALM_LINK_PROOF,
    // URL-safe: the token also travels in the fragment of an OAuth redirect
    token: randomBytes(32).toString('base64url'),
    data: linkProofData(proofEntries, Date.now(), clientId),
  });
  return { realms, proofToken: token.token };
}

/**
 * Discovery with a password (`local` and `username`): the credentials are checked against
 * every account holding the identifier (up to DISCOVERY_PASSWORD_MAX_ACCOUNTS, since each check
 * is a bcrypt compare), each under its own home realm's rules. When no account accepts them,
 * the answer is the generic failed login.
 */
export async function discoverWithPassword(params: {
  identifier: Indexable;
  password: string;
  strategyKey: 'local' | 'username';
  clientId: string;
}): Promise<DiscoveryAnswer> {
  const config = ConfigController.getInstance().config;
  const users = await User.getInstance().findMany(params.identifier, {
    select: '+hashedPassword',
    limit: DISCOVERY_PASSWORD_MAX_ACCOUNTS,
  });
  const accounts: DiscoveryAccount[] = [];
  for (const user of users) {
    if (!user.active) continue;
    const home = await homeContextOf(user);
    if (!home.ok) continue;
    const verificationRequired = home.ctx
      ? home.ctx.effective.strategies.local.verificationRequired
      : config.local.verification.required;
    const matches = user.hashedPassword
      ? await AuthUtils.checkPassword(params.password, user.hashedPassword)
      : false;
    const accepted = isDiscoveryAccepted({
      active: user.active,
      strategyEnabledAtHome: strategyEnabledAtHome(home.ctx, params.strategyKey),
      password: {
        hashed: !!user.hashedPassword,
        matches,
        verificationRequired,
        isVerified: user.isVerified,
      },
    });
    if (accepted) accounts.push(accountOf(user, home.ctx));
  }
  if (accounts.length === 0) {
    throw new GrpcError(status.UNAUTHENTICATED, 'Invalid login credentials');
  }
  return issueDiscoveryAnswer(accounts, params.clientId);
}

/** The accounts of the given users that accept a login by `strategyKey` (no password). */
async function acceptedAccounts(
  users: Pick<User, '_id' | 'homeRealm' | 'active' | 'hasTwoFA'>[],
  strategyKey: string,
): Promise<DiscoveryAccount[]> {
  const accounts: DiscoveryAccount[] = [];
  for (const user of users) {
    const home = await homeContextOf(user);
    if (!home.ok) continue;
    const accepted = isDiscoveryAccepted({
      active: user.active,
      strategyEnabledAtHome: strategyEnabledAtHome(home.ctx, strategyKey),
    });
    if (accepted) accounts.push(accountOf(user, home.ctx));
  }
  return accounts;
}

/**
 * Discovery after a phone code: the code proves the number, so every account holding it is
 * listed. No account is not an error here, the answer is an empty list.
 */
export async function discoverWithPhone(
  phoneNumber: string,
  clientId: string,
): Promise<DiscoveryAnswer> {
  const users = await User.getInstance().findMany(
    { phoneNumber },
    { limit: DISCOVERY_MAX_ACCOUNTS },
  );
  return issueDiscoveryAnswer(await acceptedAccounts(users, 'phone'), clientId);
}

/**
 * Discovery after an OAuth round trip. The provider proved the identity: the accounts holding
 * its provider id are listed. An account matched only by its email is listed when account
 * linking is allowed for its scope: the realm's `accountLinking` for the provider when its
 * home realm sets one, else the global `globalAccountLinking` (a global account always uses
 * the global setting). No account is an empty list, as for the phone.
 */
export async function discoverWithOAuth(
  provider: string,
  identity: { id?: unknown; email?: unknown },
  options: { clientId: string; globalAccountLinking: boolean },
): Promise<DiscoveryAnswer> {
  const filter = oauthDiscoveryFilter(provider, identity);
  if (!filter) return { realms: [] };
  const users = await User.getInstance().findMany(filter, {
    limit: DISCOVERY_MAX_ACCOUNTS,
  });
  const strategyKey = `oauth.${provider}`;
  const accounts: DiscoveryAccount[] = [];
  for (const user of users) {
    const home = await homeContextOf(user);
    if (!home.ok) continue;
    const match = oauthAccountMatch(identity, {
      providerId: (user as Indexable)[provider]?.id,
      email: user.email,
    });
    const accountLinking = oauthAccountLinking(
      home.ctx
        ? home.ctx.effective.strategies.oauth[provider as RealmOAuthProviderKey]
            ?.accountLinking
        : undefined,
      options.globalAccountLinking,
    );
    if (!oauthAccountListed(match, accountLinking)) continue;
    const accepted = isDiscoveryAccepted({
      active: user.active,
      strategyEnabledAtHome: strategyEnabledAtHome(home.ctx, strategyKey),
    });
    if (accepted) accounts.push(accountOf(user, home.ctx));
  }
  return issueDiscoveryAnswer(accounts, options.clientId);
}

/**
 * The live proof token row, or null when it is unknown, not a proof token, or expired. An
 * expired row is deleted when found (the cleanup removes the rest, see
 * purgeExpiredLinkProofs). The entry for the source realm is read with `decideLinkProofUse`.
 */
export async function findLinkProof(
  proofToken: string,
  now: number = Date.now(),
): Promise<Token | null> {
  const token = await Token.getInstance().findOne(
    { tokenType: TokenType.REALM_LINK_PROOF, token: proofToken },
    { readPreference: 'primary' },
  );
  if (!token) return null;
  if (isLinkProofLive(token.data, now)) return token;
  await Token.getInstance().deleteOne({
    _id: token._id,
    tokenType: TokenType.REALM_LINK_PROOF,
  });
  return null;
}

/**
 * Deletes the link proof rows whose `data.expiresAt` has passed. The rows are read by type and
 * filtered here: a comparison on a JSON field is not portable across the database adapters.
 */
export async function purgeExpiredLinkProofs(now: number = Date.now()): Promise<void> {
  const rows = await Token.getInstance().findMany({
    tokenType: TokenType.REALM_LINK_PROOF,
  });
  for (const row of rows) {
    if (isLinkProofLive(row.data, now)) continue;
    await Token.getInstance().deleteOne({
      _id: row._id,
      tokenType: TokenType.REALM_LINK_PROOF,
    });
  }
}

/**
 * Spends a proof token (single use): the conditional delete must remove the row, so two
 * requests with the same proof cannot both link. Throws INVALID_LINK_PROOF otherwise.
 */
export async function consumeLinkProof(token: Token): Promise<void> {
  const consumed = await Token.getInstance().deleteOne({
    _id: token._id,
    tokenType: TokenType.REALM_LINK_PROOF,
  });
  if (!isProofConsumed(consumed)) throw new ModuleError(errors.INVALID_LINK_PROOF);
}
