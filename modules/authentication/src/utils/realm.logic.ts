import { GrpcError, Indexable } from '@conduitplatform/grpc-sdk';
import { ModuleError } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { errors } from '../errors.js';

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
  };
};

/** Settings with the oauth secrets merged back in (what `buildEffectiveSettings` reads). */
export type RealmSettingsData = {
  active: boolean;
  strategies: RealmStrategies;
  registration: { allowWithoutInvite: boolean };
  policies: RealmPolicies;
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
};

/** The part of a write body that goes into RealmSettings (no secrets, no read flags). */
export type RealmSettingsPatch = {
  active?: boolean;
  strategies?: Partial<Omit<RealmStrategies, 'oauth'>> & {
    oauth?: Partial<Record<RealmOAuthProviderKey, Partial<RealmOAuthPublicStrategy>>>;
  };
  registration?: Partial<RealmSettingsData['registration']>;
  policies?: PartialRealmPolicies;
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

export function isValidSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && REALM_SLUG_PATTERN.test(slug);
}

/** Normalizes and validates a slug, throwing INVALID_ARGUMENT when it is malformed. */
export function assertValidSlug(slug: unknown): string {
  const normalized = typeof slug === 'string' ? normalizeSlug(slug) : '';
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
      guests: { allowed: true, allowedHomeRealms: [] },
    },
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

const OAUTH_SECRET_FIELDS: RealmOAuthSecretField[] = ['clientSecret', 'privateKey'];
const OAUTH_READ_FLAGS = ['hasClientSecret', 'hasPrivateKey'] as const;

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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

/**
 * Contract read shape: `has*` flags per provider instead of secret values, and no
 * `oauthSecrets` key. Accepts stored settings (with or without `oauthSecrets`) as well
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
    const publicFields: Record<string, any> = { ...entry };
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
  return {
    ...rest,
    strategies: { ...(strategies as any), oauth },
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
    clientId: nonEmptyString(realm.clientId) ?? global.clientId ?? '',
    clientSecret: nonEmptyString(realm.clientSecret) ?? global.clientSecret ?? '',
    redirect_uri: nonEmptyString(realm.redirect_uri) ?? global.redirect_uri ?? '',
    accountLinking:
      typeof realm.accountLinking === 'boolean'
        ? realm.accountLinking
        : (global.accountLinking ?? true),
  };
  if (provider === 'apple') {
    // Apple credentials are a set: a partially overridden set is meaningless, so the
    // private key, team id and key id all come from the realm or all from global.
    const own =
      nonEmptyString(realm.privateKey) &&
      nonEmptyString(realm.teamId) &&
      nonEmptyString(realm.keyId);
    effective.privateKey = own ? realm.privateKey : (global.privateKey ?? '');
    effective.teamId = own ? realm.teamId : (global.teamId ?? '');
    effective.keyId = own ? realm.keyId : (global.keyId ?? '');
  }
  return effective;
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
  const oauth = {} as Record<RealmOAuthProviderKey, EffectiveOAuthSettings>;
  for (const provider of REALM_OAUTH_PROVIDERS) {
    oauth[provider] = overlayOAuth(
      provider,
      globalConfig?.[provider],
      strategies.oauth?.[provider],
    );
  }
  return {
    strategies: {
      local: {
        enabled: strategies.local?.enabled === true,
        verificationRequired:
          typeof strategies.local?.verificationRequired === 'boolean'
            ? strategies.local.verificationRequired
            : (globalConfig?.local?.verification?.required ?? false),
      },
      username: { enabled: strategies.username?.enabled === true },
      magicLink: { enabled: strategies.magicLink?.enabled === true },
      phone: { enabled: strategies.phone?.enabled === true },
      metamask: { enabled: strategies.metamask?.enabled === true },
      biometric: { enabled: strategies.biometric?.enabled === true },
      oauth,
    },
    registration: {
      allowWithoutInvite:
        realmSettings.registration?.allowWithoutInvite ??
        defaults.registration.allowWithoutInvite,
    },
    policies: {
      requireTwoFa: policies.requireTwoFa === true,
      requireVerifiedEmail: policies.requireVerifiedEmail === true,
      allowedClientIds: normalizeIdList(policies.allowedClientIds),
      guests: {
        allowed: policies.guests?.allowed ?? defaults.policies.guests.allowed,
        allowedHomeRealms: normalizeIdList(policies.guests?.allowedHomeRealms),
      },
    },
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
 *  - any other realm: needs a guest membership, the guest policy and the policies.
 */
export function evaluateRealmAccess(input: RealmAccessInput): RealmAccessResult {
  const { requestedRealm, userHomeRealm, membershipType, policies, assurance } = input;
  const requested = requestedRealm ? String(requestedRealm) : null;
  const home = userHomeRealm ? String(userHomeRealm) : null;

  if (!requested) {
    return home ? { allowed: false, error: 'REALM_ACCESS_DENIED' } : { allowed: true };
  }
  // fail closed: a realm was requested but its policies could not be resolved
  if (!policies) return { allowed: false, error: 'REALM_ACCESS_DENIED' };

  if (requested !== home) {
    if (membershipType !== 'guest') {
      return { allowed: false, error: 'REALM_ACCESS_DENIED' };
    }
    const guest = evaluateGuestAllowed(policies, home);
    if (!guest.allowed) return guest;
  }
  return evaluatePolicies(policies, assurance);
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
// DTOs
// ---------------------------------------------------------------------------

export type RealmMembershipDto = {
  _id: string;
  user: string;
  realm: string;
  type: RealmMembershipType;
  createdAt?: string;
};

function toIsoString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const date = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

/** Contract `RealmMembership` shape (the stored field is `membershipType`). */
export function toRealmMembershipDto(doc: {
  _id: unknown;
  user: unknown;
  realm: unknown;
  membershipType: RealmMembershipType;
  createdAt?: unknown;
}): RealmMembershipDto {
  const dto: RealmMembershipDto = {
    _id: String(doc._id),
    user: String(doc.user),
    realm: String(doc.realm),
    type: doc.membershipType,
  };
  const createdAt = toIsoString(doc.createdAt);
  if (createdAt !== undefined) dto.createdAt = createdAt;
  return dto;
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
