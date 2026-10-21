import { GrpcError, Indexable } from '@conduitplatform/grpc-sdk';
import { ModuleError } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { errors } from '../errors.js';
import { isRecord } from './common.logic.js';

/*
 * Pure realm logic (no database or grpc access) so it can be unit tested like
 * emailRestrictions. IO lives in ./realm.ts, which re-exports everything here.
 */

/**
 * Whether the realms feature is on. Realms are a teams feature (memberships need the
 * authorization relations teams set up, invitation checks are gated on teams), so both
 * flags are required.
 */
export function computeRealmsEnabled(
  teams: { enabled?: unknown; realms?: { enabled?: unknown } } | null | undefined,
): boolean {
  return teams?.enabled === true && teams?.realms?.enabled === true;
}

/**
 * Whether a config update switches the realms feature from on to off. `previousTeams` is
 * the applied `teams` config, `incomingTeams` the `teams` section of the update, which
 * may be partial (an absent flag keeps the applied value). Only this transition needs the
 * database check of `realmsDisableBlockedMessage`; every other update skips it.
 */
export function isRealmsDisableTransition(
  previousTeams: { enabled?: unknown; realms?: { enabled?: unknown } } | null | undefined,
  incomingTeams: { enabled?: unknown; realms?: { enabled?: unknown } } | null | undefined,
): boolean {
  if (!computeRealmsEnabled(previousTeams)) return false;
  return !computeRealmsEnabled({
    enabled: incomingTeams?.enabled ?? previousTeams?.enabled,
    realms: {
      enabled: incomingTeams?.realms?.enabled ?? previousTeams?.realms?.enabled,
    },
  });
}

/** Why a config update that disables realms is refused, or null when it may proceed. */
export function realmsDisableBlockedMessage(enabledRealmCount: number): string | null {
  if (!(enabledRealmCount > 0)) return null;
  return `${enabledRealmCount} enabled realm(s) exist; demote them before disabling realms`;
}

export const REALM_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}$/;

export const REALM_OAUTH_PROVIDERS = [
  'apple',
  'bitbucket',
  'facebook',
  'figma',
  'github',
  'gitlab',
  'google',
  'linkedin',
  'microsoft',
  'reddit',
  'slack',
  'twitch',
  'twitter',
] as const;

export type RealmOAuthProviderKey = (typeof REALM_OAUTH_PROVIDERS)[number];

export type RealmMembershipType = 'home' | 'guest';

export type RealmOAuthStrategy = {
  enabled: boolean;
  clientId?: string;
  clientSecret?: string;
  redirect_uri?: string;
  accountLinking?: boolean;
  // apple only
  privateKey?: string;
  teamId?: string;
  keyId?: string;
};

export type RealmOAuthSecretField = 'clientSecret' | 'privateKey';

/** What the database stores per provider: the strategy without its secrets. */
export type RealmOAuthPublicStrategy = Omit<RealmOAuthStrategy, RealmOAuthSecretField>;

/** Write-only secrets, kept apart from `strategies` (see RealmSettings.oauthSecrets). */
export type RealmOAuthSecrets = Partial<
  Record<RealmOAuthProviderKey, { clientSecret?: string; privateKey?: string }>
>;

export type RealmStrategies = {
  local: { enabled: boolean; verificationRequired?: boolean };
  username: { enabled: boolean };
  magicLink: { enabled: boolean };
  phone: { enabled: boolean };
  metamask: { enabled: boolean };
  biometric: { enabled: boolean };
  oauth: Partial<Record<RealmOAuthProviderKey, RealmOAuthStrategy>>;
};

/** Strategies as stored in RealmSettings: oauth entries carry no secrets. */
export type StoredRealmStrategies = Omit<RealmStrategies, 'oauth'> & {
  oauth: Partial<Record<RealmOAuthProviderKey, RealmOAuthPublicStrategy>>;
};

export type RealmPolicies = {
  requireTwoFa: boolean;
  requireVerifiedEmail: boolean;
  allowedClientIds: string[];
  guests: {
    allowed: boolean;
    allowedHomeRealms: string[];
    /**
     * Linked guests may sign in at this realm with their own credentials (the strategy must
     * be enabled at their home realm). Off: a guest signs in at home and enters the realm.
     */
    directSignIn: boolean;
  };
};

/**
 * Account linking of a realm. `inbound`: accounts of other realms may connect into this one.
 * `outbound`: this realm's accounts may connect into other realms.
 */
export type RealmLinking = {
  inbound: boolean;
  outbound: boolean;
};

/** Settings with the oauth secrets merged back in (what `buildEffectiveSettings` reads). */
export type RealmSettingsData = {
  active: boolean;
  strategies: RealmStrategies;
  registration: { allowWithoutInvite: boolean };
  policies: RealmPolicies;
  linking: RealmLinking;
};

/** Settings as stored: secrets live in `oauthSecrets` (select: false), not in oauth. */
export type StoredRealmSettingsData = Omit<RealmSettingsData, 'strategies'> & {
  strategies: StoredRealmStrategies;
  oauthSecrets?: RealmOAuthSecrets | null;
};

export type MaskedRealmOAuthStrategy = RealmOAuthPublicStrategy & {
  hasClientSecret: boolean;
  /** apple only */
  hasPrivateKey?: boolean;
};

export type MaskedRealmStrategies = Omit<RealmStrategies, 'oauth'> & {
  oauth: Partial<Record<RealmOAuthProviderKey, MaskedRealmOAuthStrategy>>;
};

export type PartialRealmPolicies = Partial<Omit<RealmPolicies, 'guests'>> & {
  guests?: Partial<RealmPolicies['guests']>;
};

/** Contract write body (POST/PATCH `/teams/:teamId/realm`) minus `slug` and `force`. */
export type RealmSettingsInput = {
  active?: boolean;
  strategies?: Partial<Omit<RealmStrategies, 'oauth'>> & {
    oauth?: Partial<
      Record<
        RealmOAuthProviderKey,
        Partial<RealmOAuthStrategy> & {
          hasClientSecret?: boolean;
          hasPrivateKey?: boolean;
        }
      >
    >;
  };
  registration?: Partial<RealmSettingsData['registration']>;
  policies?: PartialRealmPolicies;
  linking?: Partial<RealmLinking>;
};

/** The part of a write body that goes into RealmSettings (no secrets, no read flags). */
export type RealmSettingsPatch = {
  active?: boolean;
  strategies?: Partial<Omit<RealmStrategies, 'oauth'>> & {
    oauth?: Partial<Record<RealmOAuthProviderKey, Partial<RealmOAuthPublicStrategy>>>;
  };
  registration?: Partial<RealmSettingsData['registration']>;
  policies?: PartialRealmPolicies;
  linking?: Partial<RealmLinking>;
};

/** Global module config, as read from ConfigController (loosely typed on purpose). */
export type GlobalAuthConfig = Record<string, any>;

export type EffectiveOAuthSettings = {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  redirect_uri: string;
  accountLinking: boolean;
  privateKey?: string;
  teamId?: string;
  keyId?: string;
};

export type EffectiveAuthSettings = {
  strategies: {
    local: { enabled: boolean; verificationRequired: boolean };
    username: { enabled: boolean };
    magicLink: { enabled: boolean };
    phone: { enabled: boolean };
    metamask: { enabled: boolean };
    biometric: { enabled: boolean };
    oauth: Record<RealmOAuthProviderKey, EffectiveOAuthSettings>;
  };
  registration: { allowWithoutInvite: boolean };
  policies: RealmPolicies;
  linking: RealmLinking;
};

export type RealmAssurance = {
  /** The session has passed 2FA (or the user has none). */
  authorized: boolean;
  hasTwoFA: boolean;
  isVerified: boolean;
  clientId: string;
};

export type RealmAccessInput = {
  /** Realm team id the session wants to be in; null = global. */
  requestedRealm: string | null;
  /** The user's home realm team id; null = global user. */
  userHomeRealm: string | null;
  membershipType: RealmMembershipType | null;
  /** Policies of the requested realm (null when requestedRealm is null). */
  policies: RealmPolicies | null;
  /**
   * Policies of the user's home realm, read when the session is a guest one in another realm
   * (null when unresolved, which fails closed). Unused for home sessions and global users.
   */
  homePolicies: RealmPolicies | null;
  assurance: RealmAssurance;
};

export type RealmErrorKey = keyof typeof errors;

export type RealmAccessResult =
  { allowed: true } | { allowed: false; error: RealmErrorKey };

// ---------------------------------------------------------------------------
// Ids
// ---------------------------------------------------------------------------

/**
 * Normalizes an id list read from storage. MySQL/MariaDB/SQLite store primitive arrays
 * joined by `;`, so an empty list reads back as `['']` and a missing one as null or
 * undefined. Anything that is not an array becomes `[]`; entries are stringified,
 * trimmed and empty ones dropped.
 */
export function normalizeIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(entry => entry !== null && entry !== undefined)
    .map(String)
    .map(entry => entry.trim())
    .filter(Boolean);
}

const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;
const NUMERIC_ID_PATTERN = /^\d{1,20}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 24-hex ObjectId, or a numeric / uuid id (SQL adapters). Slugs are not ids. */
export function isRealmId(value: unknown): boolean {
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  const id = String(value);
  return (
    OBJECT_ID_PATTERN.test(id) || NUMERIC_ID_PATTERN.test(id) || UUID_PATTERN.test(id)
  );
}

/** Returns the id as a string or throws INVALID_ARGUMENT (a programming error). */
export function assertRealmId(value: unknown): string {
  if (!isRealmId(value)) {
    throw new GrpcError(status.INVALID_ARGUMENT, 'realm must be a realm team id');
  }
  return String(value);
}

// ---------------------------------------------------------------------------
// Slugs
// ---------------------------------------------------------------------------

export function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

/**
 * The `realm` value that names the global scope (users without a home realm) explicitly.
 * It is reserved: no realm may take it as a slug, so the value never names two scopes.
 */
export const GLOBAL_REALM_SCOPE = 'global';

/** Whether a `realm` request value names the global scope (case and spaces ignored). */
export function isGlobalRealmScope(realm: unknown): boolean {
  return typeof realm === 'string' && normalizeSlug(realm) === GLOBAL_REALM_SCOPE;
}

export function isValidSlug(slug: unknown): slug is string {
  return (
    typeof slug === 'string' &&
    REALM_SLUG_PATTERN.test(slug) &&
    slug !== GLOBAL_REALM_SCOPE
  );
}

/** Normalizes and validates a slug, throwing INVALID_ARGUMENT when it is malformed. */
export function assertValidSlug(slug: unknown): string {
  // a realm created with 'global' before it was reserved keeps the slug: admin reads and demote
  // address the team by id and never validate the slug, so they still work (no migration)
  const normalized = typeof slug === 'string' ? normalizeSlug(slug) : '';
  if (normalized === GLOBAL_REALM_SCOPE) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      `Realm slug "${GLOBAL_REALM_SCOPE}" is reserved for the global scope`,
    );
  }
  if (!isValidSlug(normalized)) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      `Realm slug must match ${REALM_SLUG_PATTERN.source}`,
    );
  }
  return normalized;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Scopes a user lookup to a home realm.
 *  - realm id: `{ homeRealm: id }`;
 *  - `null`/`undefined` (global): matches both `null` and missing, same `$or` shape
 *    `admin/team.ts` uses for `parentTeam`. It is wrapped in `$and` so it can never
 *    collide with a caller's own top-level `$or`; spread it only into queries without
 *    a `$and` of their own, otherwise use `withHomeScope`.
 */
export function homeScopedQuery(realmId: string | null | undefined): Indexable {
  if (realmId) return { homeRealm: String(realmId) };
  return { $and: [{ $or: [{ homeRealm: null }, { homeRealm: { $exists: false } }] }] };
}

/**
 * Adds the home realm scope to an existing query, preserving the caller's own
 * `$or`/`$and` clauses (the scope is appended to `$and`, never overwriting it).
 */
export function withHomeScope(
  query: Indexable | null | undefined,
  realmId: string | null | undefined,
): Indexable {
  const base: Indexable = { ...(query ?? {}) };
  const scope = homeScopedQuery(realmId);
  const scopeClauses: Indexable[] = Array.isArray(scope.$and) ? scope.$and : [scope];
  const existing: Indexable[] = Array.isArray(base.$and)
    ? base.$and
    : base.$and
      ? [base.$and]
      : [];
  return { ...base, $and: [...existing, ...scopeClauses] };
}

// ---------------------------------------------------------------------------
// Identity mode
// ---------------------------------------------------------------------------

/**
 * `shared`: identifiers are unique across the deployment (global users and every realm
 * share one namespace). `isolated`: identifiers are unique per home realm, global users
 * forming their own scope.
 */
export type IdentityMode = 'shared' | 'isolated';

/**
 * The identity mode an applied `teams` config means. With realms off the mode is always
 * `shared`, whatever `realms.identityMode` holds, because no realm can own an identity.
 */
export function computeIdentityMode(
  teams:
    | { enabled?: unknown; realms?: { enabled?: unknown; identityMode?: unknown } }
    | null
    | undefined,
): IdentityMode {
  if (!computeRealmsEnabled(teams)) return 'shared';
  return teams?.realms?.identityMode === 'isolated' ? 'isolated' : 'shared';
}

/**
 * The query a uniqueness check of an identifier must run. In shared mode it is the query
 * itself (the check is deployment-wide, so `realmId` is ignored). In isolated mode it is
 * scoped to the home realm (`null` = global users), so the same identifier may exist under
 * another home realm.
 */
export function uniquenessQuery(
  identifierQuery: Indexable,
  realmId: string | null | undefined,
  mode: IdentityMode,
): Indexable {
  if (mode === 'isolated') return withHomeScope(identifierQuery, realmId);
  return identifierQuery;
}

type TeamsModeFlags = {
  enabled?: unknown;
  realms?: { enabled?: unknown; identityMode?: unknown };
};

/**
 * Whether a config update moves the identity mode from `isolated` to `shared`, judged on
 * the computed mode (see computeIdentityMode), not on the stored value. Disabling realms or
 * teams therefore counts too: the deployment turns shared, so isolated duplicates would
 * become ambiguous. `previousTeams` is the applied `teams` config and `incomingTeams` the
 * `teams` section of the update, which may be partial or absent: an absent flag keeps the
 * applied value.
 */
export function isIdentityModeRevertTransition(
  previousTeams: TeamsModeFlags | null | undefined,
  incomingTeams: TeamsModeFlags | null | undefined,
): boolean {
  const merged: TeamsModeFlags = {
    enabled: incomingTeams?.enabled ?? previousTeams?.enabled,
    realms: {
      enabled: incomingTeams?.realms?.enabled ?? previousTeams?.realms?.enabled,
      identityMode:
        incomingTeams?.realms?.identityMode ?? previousTeams?.realms?.identityMode,
    },
  };
  return (
    computeIdentityMode(previousTeams) === 'isolated' &&
    computeIdentityMode(merged) === 'shared'
  );
}

/** Why a config update that returns to shared mode is refused, or null when it may proceed. */
export function identityModeRevertBlockedMessage(collisionCount: number): string | null {
  if (!(collisionCount > 0)) return null;
  return `${collisionCount} identifier(s) are held by more than one account; identity mode cannot return to shared`;
}

/** The values `teams.realms.identityMode` may take. */
export const IDENTITY_MODES: readonly IdentityMode[] = ['shared', 'isolated'];

/**
 * Why a `teams.realms.identityMode` value is refused, or null when it names a mode. An absent
 * value (undefined) is not checked: a partial config update keeps the applied value. The
 * schema declares the value as a String, and convict does not enforce `enum`, so this check
 * is what rejects an unknown mode (any other value would silently act as shared).
 */
export function identityModeConfigError(value: unknown): string | null {
  if (value === undefined) return null;
  if (
    typeof value === 'string' &&
    (IDENTITY_MODES as readonly string[]).includes(value)
  ) {
    return null;
  }
  return `teams.realms.identityMode must be one of: ${IDENTITY_MODES.join(', ')}`;
}

/** Identifier kinds that shared mode keeps unique. OAuth ids are keyed per provider. */
export type IdentifierKind =
  'email' | 'phoneNumber' | 'username' | 'metamask' | `oauth.${RealmOAuthProviderKey}`;

export const IDENTIFIER_KINDS: readonly IdentifierKind[] = [
  'email',
  'phoneNumber',
  'username',
  'metamask',
  ...REALM_OAUTH_PROVIDERS.map(provider => `oauth.${provider}` as IdentifierKind),
];

/**
 * The identifier fields of a user as read by the collision scan. Only these fields are
 * selected; `homeRealm` is carried for diagnostics but does not change the result: a
 * collision is a collision in shared mode whatever realm the holders belong to.
 */
export type IdentifierUser = {
  _id?: unknown;
  homeRealm?: unknown;
  email?: unknown;
  phoneNumber?: unknown;
  username?: unknown;
  metamask?: { ethPublicAddress?: unknown } | null;
} & { [provider in RealmOAuthProviderKey]?: { id?: unknown } | null };

export type IdentifierCollisionCounts = {
  /** Sum of `byKind`: distinct values held by more than one user, over all kinds. */
  total: number;
  byKind: Record<IdentifierKind, number>;
};

export type IdentifierCollisionCounter = {
  /** Adds one batch of users. Batches may overlap; a user is counted once per value. */
  add(users: readonly IdentifierUser[]): void;
  result(): IdentifierCollisionCounts;
};

/** Case-insensitive kinds are normalized the way the registration paths store them. */
const CASE_INSENSITIVE_KINDS: ReadonlySet<IdentifierKind> = new Set<IdentifierKind>([
  'email',
  'username',
  'metamask',
]);

/** The non-empty, normalized identifier values a user holds. */
function identifierValuesOf(user: IdentifierUser): Array<[IdentifierKind, string]> {
  const candidates: Array<[IdentifierKind, unknown]> = [
    ['email', user.email],
    ['phoneNumber', user.phoneNumber],
    ['username', user.username],
    ['metamask', user.metamask?.ethPublicAddress],
    ...REALM_OAUTH_PROVIDERS.map((provider): [IdentifierKind, unknown] => [
      `oauth.${provider}`,
      user[provider]?.id,
    ]),
  ];
  const values: Array<[IdentifierKind, string]> = [];
  for (const [kind, raw] of candidates) {
    if (typeof raw !== 'string' || raw.trim() === '') continue;
    values.push([kind, CASE_INSENSITIVE_KINDS.has(kind) ? raw.toLowerCase() : raw]);
  }
  return values;
}

/**
 * Incremental collision detection for the switch to shared mode. Feed it the users in
 * batches (the IO scan does this) and read the result once. Holders are tracked by `_id`,
 * so a user that a concurrent write makes appear in two pages is still counted once.
 */
export function createIdentifierCollisionCounter(): IdentifierCollisionCounter {
  // "kind\0value" -> ids of the users holding it
  const holders = new Map<string, Set<string>>();
  let anonymousHolders = 0;
  return {
    add(users) {
      for (const user of users) {
        const holderId =
          user._id === undefined || user._id === null
            ? `#${anonymousHolders++}`
            : String(user._id);
        for (const [kind, value] of identifierValuesOf(user)) {
          const key = `${kind}\u0000${value}`;
          let ids = holders.get(key);
          if (!ids) {
            ids = new Set<string>();
            holders.set(key, ids);
          }
          ids.add(holderId);
        }
      }
    },
    result() {
      const byKind = Object.fromEntries(
        IDENTIFIER_KINDS.map(kind => [kind, 0]),
      ) as Record<IdentifierKind, number>;
      for (const [key, ids] of holders) {
        if (ids.size < 2) continue;
        byKind[key.slice(0, key.indexOf('\u0000')) as IdentifierKind] += 1;
      }
      const total = IDENTIFIER_KINDS.reduce((sum, kind) => sum + byKind[kind], 0);
      return { total, byKind };
    },
  };
}

/** Counts the identifier values held by more than one user, from batches of users. */
export function findIdentifierCollisions(
  batches: Iterable<readonly IdentifierUser[]>,
): IdentifierCollisionCounts {
  const counter = createIdentifierCollisionCounter();
  for (const batch of batches) counter.add(batch);
  return counter.result();
}

// ---------------------------------------------------------------------------
// One principal per realm
//
// For a realm R and an identifier I at most one principal signs in at R with I: R's own
// home account, or one linked guest. Shared mode gets that for free (identifiers are
// global); isolated mode checks it when an account joins R (register, link, guest add,
// promote, re-home) and when an identifier changes.
// ---------------------------------------------------------------------------

/** An identifier, with the query that finds its holders (the stored value, as is). */
export type IdentifierQuery = { kind: IdentifierKind; query: Indexable };

/** The query that finds the holders of one identifier value. */
export function identifierQuery(kind: IdentifierKind, value: string): IdentifierQuery {
  if (kind === 'email') return { kind, query: { email: value } };
  if (kind === 'phoneNumber') return { kind, query: { phoneNumber: value } };
  if (kind === 'username') return { kind, query: { username: value } };
  if (kind === 'metamask') {
    return { kind, query: { 'metamask.ethPublicAddress': value } };
  }
  const provider = kind.slice('oauth.'.length);
  return { kind, query: { [`${provider}.id`]: value } };
}

/**
 * Every identifier a user holds: email, phone, username, wallet and each provider id. The
 * values are read as stored (not normalized), so each query finds the same holders the
 * stored value does.
 */
export function identifierQueriesOf(user: IdentifierUser): IdentifierQuery[] {
  const queries: IdentifierQuery[] = [];
  const add = (kind: IdentifierKind, value: unknown) => {
    if (typeof value === 'string' && value.trim() !== '') {
      queries.push(identifierQuery(kind, value));
    }
  };
  add('email', user.email);
  add('phoneNumber', user.phoneNumber);
  add('username', user.username);
  add('metamask', user.metamask?.ethPublicAddress);
  for (const provider of REALM_OAUTH_PROVIDERS) {
    add(`oauth.${provider}`, user[provider]?.id);
  }
  return queries;
}

/** The side of a realm on which a clashing holder sits: its home account or a guest. */
export type PrincipalClash = 'home' | 'guest' | null;

/**
 * Which holder of an identifier breaks the one-principal rule at realm R (null = none).
 *  - `holders`: the accounts holding one of the identifiers, with their stored `homeRealm`;
 *  - `guestUserIds`: the ids of the accounts with a guest membership in R;
 *  - `excludeUserId`: the account being judged, which never clashes with itself.
 * Shared mode never clashes here (uniqueness is deployment-wide). Realm `null` is the
 * global scope, which has no guests.
 */
export function findPrincipalClash(params: {
  mode: IdentityMode;
  realmId: string | null | undefined;
  excludeUserId?: string | null;
  holders: ReadonlyArray<{ _id: unknown; homeRealm?: unknown }>;
  guestUserIds: readonly string[];
}): PrincipalClash {
  if (params.mode !== 'isolated') return null;
  const realm = params.realmId ? String(params.realmId) : null;
  const exclude = params.excludeUserId ? String(params.excludeUserId) : null;
  const others = params.holders.filter(holder => String(holder._id) !== exclude);
  if (
    others.some(holder => (holder.homeRealm ? String(holder.homeRealm) : null) === realm)
  ) {
    return 'home';
  }
  if (realm) {
    const guests = new Set(params.guestUserIds.map(String));
    if (others.some(holder => guests.has(String(holder._id)))) return 'guest';
  }
  return null;
}

/**
 * Users of a batch that is about to join one realm and hold an identifier that an earlier
 * user of the same batch already holds. Both would be principals of the realm, so the later
 * one clashes. Returns the ids of the clashing users.
 */
export function findBatchPrincipalClashes(
  users: ReadonlyArray<{ _id: unknown; queries: readonly IdentifierQuery[] }>,
): string[] {
  const firstHolder = new Map<string, string>();
  const clashing: string[] = [];
  for (const user of users) {
    const id = String(user._id);
    let clashes = false;
    for (const { kind, query } of user.queries) {
      const key = `${kind}\u0000${JSON.stringify(query)}`;
      const holder = firstHolder.get(key);
      if (holder === undefined) firstHolder.set(key, id);
      else if (holder !== id) clashes = true;
    }
    if (clashes) clashing.push(id);
  }
  return clashing;
}

/**
 * Whether a registration or an OAuth sign-up at realm R, which found an existing account
 * holding the identifier, offers the link of that account instead of refusing. Shared mode
 * only: the identifier is unique deployment-wide, so the account exists elsewhere and R may take
 * it in as a guest. Not offered when R takes no inbound links, when the account is home at R
 * (a plain duplicate), or when it is already a guest of R (the link exists already).
 * Isolated mode never offers it: the registration creates R's own account.
 */
export function isAccountLinkOffered(params: {
  mode: IdentityMode;
  realmId: string | null | undefined;
  inboundLinking: boolean;
  holderHomeRealm: unknown;
  holderIsGuest: boolean;
}): boolean {
  if (params.mode !== 'shared') return false;
  const realm = params.realmId ? String(params.realmId) : null;
  if (!realm || !params.inboundLinking) return false;
  const home = params.holderHomeRealm ? String(params.holderHomeRealm) : null;
  if (home === realm) return false;
  return !params.holderIsGuest;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function defaultRealmSettings(): RealmSettingsData {
  return {
    active: true,
    strategies: {
      local: { enabled: true },
      username: { enabled: false },
      magicLink: { enabled: false },
      phone: { enabled: false },
      metamask: { enabled: false },
      biometric: { enabled: false },
      oauth: {},
    },
    registration: { allowWithoutInvite: false },
    policies: {
      requireTwoFa: false,
      requireVerifiedEmail: false,
      allowedClientIds: [],
      guests: { allowed: true, allowedHomeRealms: [], directSignIn: true },
    },
    linking: { inbound: false, outbound: true },
  };
}

const OAUTH_CLEARABLE_LEAVES = ['clientId', 'redirect_uri', 'accountLinking'] as const;
const OAUTH_APPLE_LEAVES = ['teamId', 'keyId'] as const;

/**
 * The strategies with EVERY leaf the schema knows present: all providers (a provider
 * missing from `strategies` is disabled), and every credential / override that is unset
 * as an explicit `null`. Nested objects are flattened columns on SQL and a write only
 * touches the leaves it defines, so an overwrite that must not keep old values (GitOps
 * import: the file is the source of truth) has to state them all.
 */
export function toFullLeafStrategies(
  strategies: StoredRealmStrategies,
): StoredRealmStrategies {
  const defaults = defaultRealmSettings().strategies;
  const oauth: Record<string, any> = {};
  for (const provider of REALM_OAUTH_PROVIDERS) {
    const entry: Record<string, any> = isRecord(strategies.oauth?.[provider])
      ? (strategies.oauth[provider] as Record<string, any>)
      : {};
    const full: Record<string, any> = { enabled: entry.enabled === true };
    const leaves: readonly string[] =
      provider === 'apple'
        ? [...OAUTH_CLEARABLE_LEAVES, ...OAUTH_APPLE_LEAVES]
        : OAUTH_CLEARABLE_LEAVES;
    for (const leaf of leaves) full[leaf] = entry[leaf] ?? null;
    oauth[provider] = full;
  }
  const toggle = (
    key: 'username' | 'magicLink' | 'phone' | 'metamask' | 'biometric',
  ) => ({
    enabled: (strategies[key] ?? defaults[key]).enabled === true,
  });
  return {
    local: {
      enabled: (strategies.local ?? defaults.local).enabled === true,
      verificationRequired: strategies.local?.verificationRequired ?? null,
    } as StoredRealmStrategies['local'],
    username: toggle('username'),
    magicLink: toggle('magicLink'),
    phone: toggle('phone'),
    metamask: toggle('metamask'),
    biometric: toggle('biometric'),
    oauth,
  };
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

// ---------------------------------------------------------------------------
// OAuth secrets
//
// Secrets are not stored inside `strategies.oauth.<provider>`: `select: false` on a
// nested field is not portable (SQL excludes by leaf name against flattened columns, and
// Mongo's nested exclusion would hide the field from the effective settings too).
// They live in the top-level, `select: false` JSON field `oauthSecrets`:
//   { [provider]: { clientSecret?: string; privateKey?: string } }
// ---------------------------------------------------------------------------

export const OAUTH_SECRET_FIELDS: RealmOAuthSecretField[] = [
  'clientSecret',
  'privateKey',
];
const OAUTH_READ_FLAGS = ['hasClientSecret', 'hasPrivateKey'] as const;

function isProvider(key: string): key is RealmOAuthProviderKey {
  return (REALM_OAUTH_PROVIDERS as readonly string[]).includes(key);
}

function pickSecrets(source: unknown): { clientSecret?: string; privateKey?: string } {
  const result: { clientSecret?: string; privateKey?: string } = {};
  if (!isRecord(source)) return result;
  for (const field of OAUTH_SECRET_FIELDS) {
    if (typeof source[field] === 'string') result[field] = source[field];
  }
  return result;
}

/**
 * Merges stored `oauthSecrets` back into the oauth entries so that the result has the
 * shape `buildEffectiveSettings` reads. Secrets of unknown providers are ignored; a
 * provider that only has secrets gets a disabled entry.
 */
export function mergeOAuthSecrets(
  settings: Omit<StoredRealmSettingsData, 'oauthSecrets'>,
  oauthSecrets: RealmOAuthSecrets | null | undefined,
): RealmSettingsData {
  const oauth: Partial<Record<RealmOAuthProviderKey, RealmOAuthStrategy>> = {
    ...settings.strategies?.oauth,
  };
  if (isRecord(oauthSecrets)) {
    for (const [provider, secrets] of Object.entries(oauthSecrets)) {
      if (!isProvider(provider)) continue;
      const picked = pickSecrets(secrets);
      if (Object.keys(picked).length === 0) continue;
      oauth[provider] = { enabled: false, ...oauth[provider], ...picked };
    }
  }
  return { ...settings, strategies: { ...settings.strategies, oauth } };
}

/** A copy without the keys whose value is `null` (unset overrides and credentials). */
function omitNullKeys<T extends Record<string, any>>(value: T): T {
  const result: Record<string, any> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== null) result[key] = entry;
  }
  return result as T;
}

/**
 * Contract read shape: `has*` flags per provider instead of secret values, and no
 * `oauthSecrets` key. Credentials and overrides that are unset are omitted: they are
 * stored as explicit `null` leaves (see `deepMergeClearing`), which the read shape drops
 * (`clientId`, `redirect_uri`, `accountLinking`, `teamId`, `keyId`,
 * `local.verificationRequired`). Accepts stored settings (with or without `oauthSecrets`) as well
 * as merged ones, so a secret is reported whichever place it is found in. Always use
 * this before returning RealmSettings from an admin route.
 */
export function maskRealmSettings<
  T extends { strategies: { oauth?: Record<string, any> }; oauthSecrets?: unknown },
>(
  settings: T,
): Omit<T, 'strategies' | 'oauthSecrets'> & { strategies: MaskedRealmStrategies } {
  const { strategies, oauthSecrets, ...rest } = settings;
  const stored: Record<string, any> = isRecord(oauthSecrets) ? oauthSecrets : {};
  const entries: Record<string, any> = isRecord(strategies?.oauth)
    ? strategies.oauth
    : {};
  const oauth: Partial<Record<RealmOAuthProviderKey, MaskedRealmOAuthStrategy>> = {};
  const providers = new Set([...Object.keys(entries), ...Object.keys(stored)]);
  for (const provider of providers) {
    if (!isProvider(provider)) continue;
    const entry = isRecord(entries[provider]) ? entries[provider] : { enabled: false };
    const publicFields: Record<string, any> = omitNullKeys(entry);
    for (const field of [...OAUTH_SECRET_FIELDS, ...OAUTH_READ_FLAGS]) {
      delete publicFields[field];
    }
    const secrets = { ...pickSecrets(entry), ...pickSecrets(stored[provider]) };
    const masked = {
      ...publicFields,
      hasClientSecret: nonEmptyString(secrets.clientSecret) !== undefined,
    } as MaskedRealmOAuthStrategy;
    if (provider === 'apple') {
      masked.hasPrivateKey = nonEmptyString(secrets.privateKey) !== undefined;
    }
    oauth[provider] = masked;
  }
  const rawLocal = (strategies as Record<string, any> | undefined)?.local;
  const local = isRecord(rawLocal) ? { local: omitNullKeys(rawLocal) } : {};
  return {
    ...rest,
    strategies: { ...(strategies as any), ...local, oauth },
  } as Omit<T, 'strategies' | 'oauthSecrets'> & { strategies: MaskedRealmStrategies };
}

/**
 * Splits a contract write body into what goes into RealmSettings (`settings`: no
 * secrets, no read-only `has*` flags) and the secrets that go into `oauthSecrets`.
 * Only `active`, `strategies`, `registration` and `policies` are carried over, so the
 * caller can pass the whole body (`slug`, `force` are ignored). An `oauthSecrets` key in
 * the input is never trusted. A secret that is an empty string means "clear it"; use
 * `applyOAuthSecretsUpdate` to combine the result with the stored secrets.
 */
export function splitRealmSettingsInput(input: RealmSettingsInput | null | undefined): {
  settings: RealmSettingsPatch;
  oauthSecrets: RealmOAuthSecrets;
} {
  const settings: RealmSettingsPatch = {};
  const oauthSecrets: RealmOAuthSecrets = {};
  if (!isRecord(input)) return { settings, oauthSecrets };
  if (input.active !== undefined) settings.active = input.active;
  if (input.registration !== undefined) settings.registration = { ...input.registration };
  if (input.linking !== undefined) settings.linking = { ...input.linking };
  if (input.policies !== undefined) {
    settings.policies = {
      ...input.policies,
      ...(input.policies.guests !== undefined
        ? { guests: { ...input.policies.guests } }
        : {}),
    };
  }
  if (input.strategies !== undefined) {
    const { oauth, ...others } = input.strategies;
    const strategies: NonNullable<RealmSettingsPatch['strategies']> = { ...others };
    if (isRecord(oauth)) {
      const publicOauth: Partial<
        Record<RealmOAuthProviderKey, Partial<RealmOAuthPublicStrategy>>
      > = {};
      for (const [provider, entry] of Object.entries(oauth)) {
        if (!isProvider(provider) || !isRecord(entry)) continue;
        const secrets = pickSecrets(entry);
        if (Object.keys(secrets).length > 0) oauthSecrets[provider] = secrets;
        const publicFields: Record<string, any> = { ...entry };
        for (const field of [...OAUTH_SECRET_FIELDS, ...OAUTH_READ_FLAGS]) {
          delete publicFields[field];
        }
        publicOauth[provider] = publicFields;
      }
      strategies.oauth = publicOauth;
    }
    settings.strategies = strategies;
  }
  return { settings, oauthSecrets };
}

/**
 * Applies the `oauthSecrets` of `splitRealmSettingsInput` on top of the stored ones:
 * per provider and field, a non-empty string replaces, an empty string clears, an
 * absent field is left alone. Providers left without secrets are dropped.
 */
export function applyOAuthSecretsUpdate(
  existing: RealmOAuthSecrets | null | undefined,
  update: RealmOAuthSecrets,
): RealmOAuthSecrets {
  const result: RealmOAuthSecrets = {};
  if (isRecord(existing)) {
    for (const [provider, secrets] of Object.entries(existing)) {
      if (isProvider(provider)) result[provider] = pickSecrets(secrets);
    }
  }
  for (const [provider, secrets] of Object.entries(update)) {
    if (!isProvider(provider)) continue;
    const next = { ...result[provider] };
    for (const [field, value] of Object.entries(pickSecrets(secrets))) {
      if (value === '') delete next[field as RealmOAuthSecretField];
      else next[field as RealmOAuthSecretField] = value;
    }
    result[provider] = next;
  }
  for (const provider of Object.keys(result) as RealmOAuthProviderKey[]) {
    if (Object.keys(result[provider] ?? {}).length === 0) delete result[provider];
  }
  return result;
}

/**
 * clientId and clientSecret are a pair: a realm that sets its own clientId takes the
 * secret from the realm only (a missing one leaves the pair incomplete, it is never
 * filled from global), and a realm that sets only a secret inherits both from global.
 */
function overlayClientCredentials(
  global: Record<string, any>,
  realm: RealmOAuthStrategy,
): Pick<EffectiveOAuthSettings, 'clientId' | 'clientSecret'> {
  const ownClientId = nonEmptyString(realm.clientId);
  if (ownClientId) {
    return {
      clientId: ownClientId,
      clientSecret: nonEmptyString(realm.clientSecret) ?? '',
    };
  }
  return { clientId: global.clientId ?? '', clientSecret: global.clientSecret ?? '' };
}

/**
 * Apple credentials are a set: a partially overridden set is meaningless, so the private
 * key, team id and key id all come from the realm or all from global.
 */
function overlayAppleCredentials(
  global: Record<string, any>,
  realm: RealmOAuthStrategy,
): Pick<EffectiveOAuthSettings, 'privateKey' | 'teamId' | 'keyId'> {
  const own =
    nonEmptyString(realm.privateKey) &&
    nonEmptyString(realm.teamId) &&
    nonEmptyString(realm.keyId);
  if (own) {
    return { privateKey: realm.privateKey, teamId: realm.teamId, keyId: realm.keyId };
  }
  return {
    privateKey: global.privateKey ?? '',
    teamId: global.teamId ?? '',
    keyId: global.keyId ?? '',
  };
}

function overlayOAuth(
  provider: RealmOAuthProviderKey,
  globalProvider: Record<string, any> | undefined,
  realmProvider: RealmOAuthStrategy | undefined,
): EffectiveOAuthSettings {
  const global = globalProvider ?? {};
  const realm = realmProvider ?? { enabled: false };
  const effective: EffectiveOAuthSettings = {
    // enablement is explicit per realm, the global flag is never inherited
    enabled: realm.enabled === true,
    ...overlayClientCredentials(global, realm),
    redirect_uri: nonEmptyString(realm.redirect_uri) ?? global.redirect_uri ?? '',
    accountLinking:
      typeof realm.accountLinking === 'boolean'
        ? realm.accountLinking
        : (global.accountLinking ?? true),
  };
  if (provider === 'apple') {
    Object.assign(effective, overlayAppleCredentials(global, realm));
  }
  return effective;
}

/**
 * The linking flags of a stored realm, each defaulted when absent (inbound off, outbound on):
 * a realm created before the flags existed reads and runs with the defaults.
 */
export function linkingFlagsOf(
  stored: { inbound?: unknown; outbound?: unknown } | null | undefined,
): RealmLinking {
  return { inbound: stored?.inbound === true, outbound: stored?.outbound !== false };
}

/** Whether a realm's guests sign in directly. A missing flag (before it existed) is on. */
export function directSignInOf(
  guests: { directSignIn?: unknown } | null | undefined,
): boolean {
  return guests?.directSignIn !== false;
}

/**
 * Stored settings with the fields added after a realm may have been created (`linking` and
 * `policies.guests.directSignIn`) filled with the value a missing field means. Reads use it,
 * so they report what the runtime applies (see buildEffectiveSettings).
 */
export function withRealmFieldDefaults(settings: Indexable): Indexable {
  const policies: Indexable = settings.policies ?? {};
  return {
    ...settings,
    linking: linkingFlagsOf(settings.linking),
    policies: {
      ...policies,
      guests: { ...policies.guests, directSignIn: directSignInOf(policies.guests) },
    },
  };
}

function enabledOf(strategy: { enabled?: boolean } | undefined): { enabled: boolean } {
  return { enabled: strategy?.enabled === true };
}

function effectiveStrategies(
  globalConfig: GlobalAuthConfig,
  strategies: RealmStrategies,
): EffectiveAuthSettings['strategies'] {
  const oauth = {} as Record<RealmOAuthProviderKey, EffectiveOAuthSettings>;
  for (const provider of REALM_OAUTH_PROVIDERS) {
    oauth[provider] = overlayOAuth(
      provider,
      globalConfig?.[provider],
      strategies.oauth?.[provider],
    );
  }
  return {
    local: {
      enabled: strategies.local?.enabled === true,
      verificationRequired:
        typeof strategies.local?.verificationRequired === 'boolean'
          ? strategies.local.verificationRequired
          : (globalConfig?.local?.verification?.required ?? false),
    },
    username: enabledOf(strategies.username),
    magicLink: enabledOf(strategies.magicLink),
    phone: enabledOf(strategies.phone),
    metamask: enabledOf(strategies.metamask),
    biometric: enabledOf(strategies.biometric),
    oauth,
  };
}

function effectivePolicies(
  policies: RealmPolicies,
  defaults: RealmPolicies,
): RealmPolicies {
  return {
    requireTwoFa: policies.requireTwoFa === true,
    requireVerifiedEmail: policies.requireVerifiedEmail === true,
    allowedClientIds: normalizeIdList(policies.allowedClientIds),
    guests: {
      allowed: policies.guests?.allowed ?? defaults.guests.allowed,
      allowedHomeRealms: normalizeIdList(policies.guests?.allowedHomeRealms),
      directSignIn: directSignInOf(policies.guests),
    },
  };
}

/**
 * Overlays a realm's settings on the global module config.
 *  - strategy enablement is explicit per realm (global `enabled` is not inherited);
 *  - OAuth credentials inherit from global when the realm leaves them empty;
 *  - everything else (token lifetimes, cookies, captcha...) stays global and is not part
 *    of the result.
 */
export function buildEffectiveSettings(
  globalConfig: GlobalAuthConfig,
  realmSettings: RealmSettingsData,
): EffectiveAuthSettings {
  const defaults = defaultRealmSettings();
  const strategies = realmSettings.strategies ?? defaults.strategies;
  const policies = realmSettings.policies ?? defaults.policies;
  return {
    strategies: effectiveStrategies(globalConfig, strategies),
    registration: {
      allowWithoutInvite:
        realmSettings.registration?.allowWithoutInvite ??
        defaults.registration.allowWithoutInvite,
    },
    policies: effectivePolicies(policies, defaults.policies),
    linking: linkingFlagsOf(realmSettings.linking),
  };
}

// ---------------------------------------------------------------------------
// Access rules
// ---------------------------------------------------------------------------

/**
 * Whether a user with the given home realm may be a guest under these policies.
 * `allowedHomeRealms` empty = any home realm, including global users.
 */
export function evaluateGuestAllowed(
  policies: Pick<RealmPolicies, 'guests'>,
  userHomeRealm: string | null | undefined,
): RealmAccessResult {
  if (!policies?.guests?.allowed) {
    return { allowed: false, error: 'GUESTS_NOT_ALLOWED' };
  }
  const trusted = normalizeIdList(policies.guests.allowedHomeRealms);
  if (trusted.length === 0) return { allowed: true };
  if (!userHomeRealm || !trusted.includes(String(userHomeRealm))) {
    return { allowed: false, error: 'GUESTS_NOT_ALLOWED' };
  }
  return { allowed: true };
}

export function assertGuestAllowed(
  policies: Pick<RealmPolicies, 'guests'>,
  userHomeRealm: string | null | undefined,
): void {
  const result = evaluateGuestAllowed(policies, userHomeRealm);
  if (!result.allowed) throw new ModuleError(errors[result.error]);
}

function evaluatePolicies(
  policies: RealmPolicies,
  assurance: RealmAssurance,
): RealmAccessResult {
  if (policies.requireTwoFa) {
    if (!assurance.hasTwoFA) {
      return { allowed: false, error: 'TWO_FA_REQUIRED_FOR_REALM' };
    }
    if (!assurance.authorized) {
      return { allowed: false, error: 'REALM_ACCESS_DENIED' };
    }
  }
  if (policies.requireVerifiedEmail && !assurance.isVerified) {
    return { allowed: false, error: 'REALM_ACCESS_DENIED' };
  }
  const clients = normalizeIdList(policies.allowedClientIds);
  if (clients.length > 0 && !clients.includes(assurance.clientId)) {
    return { allowed: false, error: 'REALM_ACCESS_DENIED' };
  }
  return { allowed: true };
}

/**
 * Decides whether a session may be issued in `requestedRealm`.
 *  - global request: allowed only for global users;
 *  - the user's own home realm: policies only;
 *  - a guest session in another realm: needs a guest membership and the guest policy, then
 *    the policies of the requested realm AND the policies of the user's home realm (a
 *    global user has no home realm, so only the requested one applies). The requested
 *    realm's result is returned first when both refuse.
 */
export function evaluateRealmAccess(input: RealmAccessInput): RealmAccessResult {
  const { requestedRealm, userHomeRealm, membershipType, policies, homePolicies } = input;
  const { assurance } = input;
  const requested = requestedRealm ? String(requestedRealm) : null;
  const home = userHomeRealm ? String(userHomeRealm) : null;

  if (!requested) {
    return home ? { allowed: false, error: 'REALM_ACCESS_DENIED' } : { allowed: true };
  }
  // fail closed: a realm was requested but its policies could not be resolved
  if (!policies) return { allowed: false, error: 'REALM_ACCESS_DENIED' };

  if (requested === home) return evaluatePolicies(policies, assurance);

  if (membershipType !== 'guest') {
    return { allowed: false, error: 'REALM_ACCESS_DENIED' };
  }
  const guest = evaluateGuestAllowed(policies, home);
  if (!guest.allowed) return guest;
  const own = evaluatePolicies(policies, assurance);
  if (!own.allowed || !home) return own;
  // the identity belongs to the home realm: its policies bind the guest session as well
  if (!homePolicies) return { allowed: false, error: 'REALM_ACCESS_DENIED' };
  return evaluatePolicies(homePolicies, assurance);
}

// ---------------------------------------------------------------------------
// Account linking
//
// A linked account is a guest of the target realm: it signs in there with its own
// credentials. The link is allowed when every rule below holds. The checks run in this order,
// and the first failure is the answer.
// ---------------------------------------------------------------------------

/**
 * How the invitation of a link relates to the target realm:
 *  - `none`: no invitation;
 *  - `inside`: a valid invitation into a team of the target realm (the realm itself or one of
 *    its sub-teams);
 *  - `invalid`: an invitation that is not valid, or that targets another realm or no realm.
 */
export type LinkInvite = 'none' | 'inside' | 'invalid';

export type LinkEligibilityInput = {
  /** The target realm team id. */
  targetRealm: string;
  /** The account's home realm, the source of the link (null = a global account). */
  sourceRealm: string | null;
  /** Whether the account already holds a membership (guest) of the target realm. */
  alreadyGuest: boolean;
  /** The target realm's `linking.inbound`. */
  targetInbound: boolean;
  /** The source realm's `linking.outbound` (true for a global account). */
  sourceOutbound: boolean;
  /** Policies of the target realm. */
  targetPolicies: RealmPolicies;
  /** Policies of the source realm (null for a global account). */
  sourcePolicies: RealmPolicies | null;
  /** Assurance of the session the link is judged for (see tokenAssurance). */
  assurance: RealmAssurance;
  /** The target's registration rule: without it an invitation is needed. */
  allowWithoutInvite: boolean;
  invite: LinkInvite;
  /** Whether another principal of the target realm holds one of the account's identifiers. */
  principalClash: boolean;
};

export type LinkEligibility =
  { allowed: true } | { allowed: false; error: RealmErrorKey };

/**
 * Whether an account may become a guest of the target realm. In order:
 *  1. the account is not already home or guest there (LINK_CONFLICT);
 *  2. the target has `linking.inbound` and the source `linking.outbound` (LINKING_NOT_ALLOWED);
 *  3. the realm access rules for a guest of the target: its guest policy (`guests.allowed`,
 *     `allowedHomeRealms`), the target's policies and the source realm's policies, as a guest
 *     session would meet them (GUESTS_NOT_ALLOWED, TWO_FA_REQUIRED_FOR_REALM, ...);
 *  4. the registration rule: an invitation into the target unless `allowWithoutInvite`
 *     (INVITATION_REQUIRED), and a given invitation must be valid and inside the target
 *     (INVALID_INVITATION);
 *  5. the one-principal rule for the identifiers (LINK_CONFLICT).
 */
export function evaluateLinkEligibility(input: LinkEligibilityInput): LinkEligibility {
  const fail = (error: RealmErrorKey): LinkEligibility => ({ allowed: false, error });
  if (input.sourceRealm !== null && String(input.sourceRealm) === input.targetRealm) {
    return fail('LINK_CONFLICT');
  }
  if (input.alreadyGuest) return fail('LINK_CONFLICT');
  if (!input.targetInbound || !input.sourceOutbound) return fail('LINKING_NOT_ALLOWED');

  const access = evaluateRealmAccess({
    requestedRealm: input.targetRealm,
    userHomeRealm: input.sourceRealm,
    membershipType: 'guest',
    policies: input.targetPolicies,
    homePolicies: input.sourcePolicies,
    assurance: input.assurance,
  });
  if (!access.allowed) return fail(access.error);

  if (input.invite === 'invalid') return fail('INVALID_INVITATION');
  if (input.invite === 'none' && !input.allowWithoutInvite) {
    return fail('INVITATION_REQUIRED');
  }
  if (input.principalClash) return fail('LINK_CONFLICT');
  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Nested realm detection
// ---------------------------------------------------------------------------

export type RealmTeamNode = {
  _id: string;
  parentTeam?: string | null;
  realm?: { enabled?: boolean; slug?: string } | null;
};

/**
 * Nearest realm team on the chain `[self, parent, grandparent, ...]` (ancestor walk
 * result), or null when none of them is a realm.
 */
export function nearestRealmInChain<T extends RealmTeamNode>(chain: T[]): T | null {
  return chain.find(team => team.realm?.enabled === true) ?? null;
}

export const MAX_TEAM_DEPTH = 64;

/**
 * Walks `startId` and its ancestors (self first), stopping at the first realm, at a
 * missing team, at a cycle or after MAX_TEAM_DEPTH teams.
 */
export async function collectTeamChain<T extends RealmTeamNode>(
  startId: string,
  fetchTeam: (id: string) => Promise<T | null>,
): Promise<T[]> {
  const chain: T[] = [];
  const seen = new Set<string>();
  let currentId: string | null | undefined = String(startId);
  while (currentId && !seen.has(currentId) && chain.length < MAX_TEAM_DEPTH) {
    seen.add(currentId);
    const team: T | null = await fetchTeam(currentId);
    if (!team) break;
    chain.push(team);
    if (team.realm?.enabled) break;
    currentId = team.parentTeam ? String(team.parentTeam) : null;
  }
  return chain;
}

/** Whether any descendant of `rootId` is a realm (level by level, cycle safe). */
export async function subtreeContainsRealm(
  rootId: string,
  fetchChildren: (parentIds: string[]) => Promise<RealmTeamNode[]>,
): Promise<boolean> {
  let level = [String(rootId)];
  const seen = new Set(level);
  for (let depth = 0; level.length > 0 && depth < MAX_TEAM_DEPTH; depth++) {
    const children = await fetchChildren(level);
    if (children.some(child => child.realm?.enabled === true)) return true;
    level = children.map(child => String(child._id)).filter(id => !seen.has(id));
    level.forEach(id => seen.add(id));
  }
  return false;
}

/**
 * Whether the team tree would contain a nested realm (the REALM_NESTED rule: a realm is
 * top-level, has no realm ancestor and no realm descendant).
 *  - `parentTeamId` undefined: the team where it currently sits;
 *  - `parentTeamId` given (null = top level): re-parenting to it;
 *  - `promote`: making the team a realm.
 */
export async function hasNestedRealmViolation(params: {
  team: RealmTeamNode;
  parentTeamId?: string | null;
  promote?: boolean;
  fetchTeam: (id: string) => Promise<RealmTeamNode | null>;
  fetchChildren: (parentIds: string[]) => Promise<RealmTeamNode[]>;
}): Promise<boolean> {
  const { team, promote, fetchTeam, fetchChildren } = params;
  const parent =
    params.parentTeamId === undefined ? team.parentTeam : params.parentTeamId;
  const isRealm = team.realm?.enabled === true || promote === true;
  if (isRealm && parent) return true;
  if (parent) {
    const ancestorRealm = nearestRealmInChain(
      await collectTeamChain(String(parent), fetchTeam),
    );
    if (ancestorRealm && (await subtreeContainsRealm(String(team._id), fetchChildren))) {
      return true;
    }
  }
  return (
    promote === true && (await subtreeContainsRealm(String(team._id), fetchChildren))
  );
}

// ---------------------------------------------------------------------------
// Token issuance decisions
// ---------------------------------------------------------------------------

/**
 * Whether token issuance must run the realm access check: only with the feature on,
 * and only when a realm is requested or the user has a home realm (so plain global
 * logins never touch the realm collections). Empty strings count as "no realm".
 */
export function shouldCheckRealmAccess(params: {
  realmsEnabled: boolean;
  realm?: string | null;
  homeRealm?: string | null;
}): boolean {
  return params.realmsEnabled && (!!params.realm || !!params.homeRealm);
}

/**
 * `authorized` is the token's 2FA state. `realmAuthorized` is what the realm check
 * sees: a partial token (user has 2FA, not passed yet) can only reach the 2FA routes
 * and the final tokens are issued by the 2FA step, which checks again with the real
 * assurance, so a partial token only evaluates the other policies (including
 * TWO_FA_REQUIRED_FOR_REALM for users without 2FA).
 */
export function tokenAssurance(params: {
  hasTwoFA: boolean;
  twoFaPass?: boolean;
  isRefresh?: boolean;
}): { authorized: boolean; realmAuthorized: boolean } {
  const authorized = !params.hasTwoFA || !!params.isRefresh || !!params.twoFaPass;
  return { authorized, realmAuthorized: authorized || params.hasTwoFA };
}

/**
 * Error for a realm that could not be resolved (unknown, disabled or inactive).
 * For the user's own home realm the user exists and their realm is switched off, so
 * it is an access denial rather than "not found".
 */
export function unresolvedRealmError(
  requestedRealm: string,
  userHomeRealm: string | null,
): RealmErrorKey {
  return String(requestedRealm) === userHomeRealm
    ? 'REALM_ACCESS_DENIED'
    : 'REALM_NOT_FOUND';
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

/**
 * Small TTL cache that hands out clones (callers cannot mutate shared state), evicts
 * expired entries on read and drops the oldest entry once `maxEntries` is reached.
 */
export class BoundedTtlCache<T> {
  private readonly entries = new Map<string, { value: T; expires: number }>();

  constructor(
    private readonly maxEntries = 500,
    private readonly now: () => number = Date.now,
  ) {}

  get size(): number {
    return this.entries.size;
  }

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expires <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return structuredClone(entry.value);
  }

  /** A ttl of 0 (or less) disables caching. */
  set(key: string, value: T, ttlMs: number): void {
    if (!(ttlMs > 0)) return;
    // re-inserting refreshes the key's position in the eviction order
    this.entries.delete(key);
    while (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
    this.entries.set(key, { value: structuredClone(value), expires: this.now() + ttlMs });
  }

  clear(): void {
    this.entries.clear();
  }
}
