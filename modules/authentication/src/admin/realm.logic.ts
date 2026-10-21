import { GrpcError, Indexable } from '@conduitplatform/grpc-sdk';
import { ModuleError } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { errors } from '../errors.js';
import { filled, isRecord } from '../utils/common.logic.js';
import {
  applyOAuthSecretsUpdate,
  directSignInOf,
  evaluateGuestAllowed,
  isRealmId,
  linkingFlagsOf,
  maskRealmSettings,
  normalizeIdList,
  normalizeSlug,
  OAUTH_SECRET_FIELDS,
  REALM_OAUTH_PROVIDERS,
  RealmOAuthSecrets,
  RealmPolicies,
  RealmSettingsInput,
  splitRealmSettingsInput,
  StoredRealmSettingsData,
  withRealmFieldDefaults,
} from '../utils/realm.logic.js';

/*
 * Pure rules of the realm admin routes (no database or grpc access). IO lives in
 * ./realm.ts.
 */

// ---------------------------------------------------------------------------
// Promote: converting the existing members of the team
// ---------------------------------------------------------------------------

export type PromoteCandidate = {
  _id: string;
  email?: string | null;
  username?: string | null;
  homeRealm?: unknown;
};

export type PromotePlan = {
  /** users that become home users of the realm (membership type home) */
  home: string[];
  /** the subset of `home` that has no home realm yet and gets it set */
  setHomeRealm: string[];
  /** users that keep their other home realm and become guests */
  guests: string[];
  /** would-be guests the realm guest policy refuses */
  rejected: PromoteCandidate[];
};

/**
 * Plans what happens to the users who already belong to a team that is promoted to a
 * realm:
 *  - no home realm: they become home users and the realm becomes their home realm;
 *  - their home realm is already this team (a realm that was demoted and promoted
 *    again): home users;
 *  - a different home realm: guests, when `policies.guests` allows their home realm,
 *    otherwise they are returned in `rejected` and the caller must fail before writing.
 */
export function planPromoteMembers(
  users: PromoteCandidate[],
  realmTeamId: string,
  policies: Pick<RealmPolicies, 'guests'>,
): PromotePlan {
  const plan: PromotePlan = { home: [], setHomeRealm: [], guests: [], rejected: [] };
  const seen = new Set<string>();
  for (const user of users) {
    const id = String(user._id);
    if (seen.has(id)) continue;
    seen.add(id);
    const home = user.homeRealm ? String(user.homeRealm) : null;
    if (!home) {
      plan.home.push(id);
      plan.setHomeRealm.push(id);
    } else if (home === String(realmTeamId)) {
      plan.home.push(id);
    } else if (evaluateGuestAllowed(policies, home).allowed) {
      plan.guests.push(id);
    } else {
      plan.rejected.push(user);
    }
  }
  return plan;
}

/**
 * A team can become a realm unless it already is one or it is the default team (new
 * users are added to the default team).
 */
export function assertTeamPromotable(team: {
  isDefault?: boolean;
  realm?: { enabled?: boolean } | null;
}): void {
  if (team.realm?.enabled) {
    throw new GrpcError(status.ALREADY_EXISTS, 'Team is already a realm');
  }
  if (team.isDefault) {
    throw new GrpcError(
      status.FAILED_PRECONDITION,
      'The default team cannot become a realm: new users are added to it. ' +
        'Make another team the default first.',
    );
  }
}

/** `id (email)` list for error messages, capped. */
export function describeUsers(users: PromoteCandidate[], max: number = 20): string {
  const shown = users.slice(0, max).map(user => {
    const label = user.email || user.username;
    return label ? `${user._id} (${label})` : String(user._id);
  });
  const rest = users.length - shown.length;
  return shown.join(', ') + (rest > 0 ? ` and ${rest} more` : '');
}

/** GUESTS_NOT_ALLOWED whose message lists the users the realm refuses as guests. */
export function guestsNotAllowedError(
  rejected: PromoteCandidate[],
  context: 'promote' | 'add',
): ModuleError {
  const prefix =
    context === 'promote'
      ? 'This realm does not allow guests from the home realms of these existing team members: '
      : 'This realm does not allow guests from the home realms of these users: ';
  return new ModuleError({
    ...errors.GUESTS_NOT_ALLOWED,
    message: prefix + describeUsers(rejected),
  });
}

// ---------------------------------------------------------------------------
// Demote and home realm moves
// ---------------------------------------------------------------------------

/**
 * Order of a realm demotion. The realm stops resolving (team flipped, cache cleared and
 * the change published) before the realm-bound sessions are swept, so no guest session
 * can be minted after the sweep. Home users are blocked first: they cannot sign in
 * anywhere meanwhile.
 */
export const DEMOTE_STEPS = [
  'blockHomeUsers',
  'deleteMemberships',
  'deleteSettings',
  'flipTeam',
  'publish',
  'sweepRealmTokens',
] as const;
export type DemoteStep = (typeof DEMOTE_STEPS)[number];

/**
 * What happens to the old home membership when a user is moved to another home realm
 * (`newHome` null = global): it becomes a guest membership when the old realm's guest
 * policy allows a user with the new home, otherwise the user loses every relation in
 * the old realm.
 */
export function planOldHomeMembership(
  oldRealmPolicies: Pick<RealmPolicies, 'guests'> | null | undefined,
  newHome: string | null,
): 'guest' | 'revoke' {
  if (!oldRealmPolicies) return 'revoke';
  return evaluateGuestAllowed(oldRealmPolicies, newHome).allowed ? 'guest' : 'revoke';
}

// ---------------------------------------------------------------------------
// Slug changes
// ---------------------------------------------------------------------------

/**
 * A slug change on PATCH needs `force: true`. Returns the new normalized slug, or
 * undefined when the slug is absent or unchanged.
 */
export function resolveSlugChange(
  currentSlug: string | undefined | null,
  requestedSlug: unknown,
  force: unknown,
): string | undefined {
  if (requestedSlug === undefined || requestedSlug === null) return undefined;
  if (typeof requestedSlug !== 'string') {
    throw new GrpcError(status.INVALID_ARGUMENT, 'slug must be a string');
  }
  const normalized = normalizeSlug(requestedSlug);
  if (normalized === (currentSlug ?? '')) return undefined;
  if (force !== true) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      'Changing the realm slug breaks clients that use it; send force: true to confirm',
    );
  }
  return normalized;
}

// ---------------------------------------------------------------------------
// Settings write body
// ---------------------------------------------------------------------------

type Record_ = Record<string, any>;

function fail(message: string): never {
  throw new GrpcError(status.INVALID_ARGUMENT, message);
}

function readRecord(value: unknown, path: string): Record_ {
  if (!isRecord(value)) fail(`${path} must be an object`);
  return value;
}

function readBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') fail(`${path} must be a boolean`);
  return value;
}

function readStringList(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || value.some(entry => typeof entry !== 'string')) {
    fail(`${path} must be an array of strings`);
  }
  return normalizeIdList(value);
}

const STRATEGY_TOGGLES = [
  'local',
  'username',
  'magicLink',
  'phone',
  'metamask',
  'biometric',
] as const;

const OAUTH_PLAIN_CREDENTIALS = ['clientId', 'redirect_uri'] as const;
const OAUTH_APPLE_CREDENTIALS = ['teamId', 'keyId'] as const;
/** `null` and blank strings clear a credential, anything else must be a string. */
function readCredential(value: unknown, path: string): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') fail(`${path} must be a string or null`);
  return value.trim() === '' ? null : value;
}

function sanitizeOAuth(oauth: unknown): Record_ {
  const result: Record_ = {};
  for (const [provider, rawEntry] of Object.entries(
    readRecord(oauth, 'strategies.oauth'),
  )) {
    const path = `strategies.oauth.${provider}`;
    if (!(REALM_OAUTH_PROVIDERS as readonly string[]).includes(provider)) {
      fail(`${path} is not a supported OAuth provider`);
    }
    const entry = readRecord(rawEntry, path);
    const clean: Record_ = {};
    if (entry.enabled !== undefined) {
      clean.enabled = readBoolean(entry.enabled, `${path}.enabled`);
    }
    if (entry.accountLinking !== undefined) {
      // null = inherit the global setting again
      clean.accountLinking =
        entry.accountLinking === null
          ? null
          : readBoolean(entry.accountLinking, `${path}.accountLinking`);
    }
    for (const field of OAUTH_PLAIN_CREDENTIALS) {
      if (entry[field] !== undefined) {
        clean[field] = readCredential(entry[field], `${path}.${field}`);
      }
    }
    for (const field of OAUTH_SECRET_FIELDS) {
      if (entry[field] === undefined) continue;
      if (field === 'privateKey' && provider !== 'apple') continue;
      // splitRealmSettingsInput/applyOAuthSecretsUpdate clear a secret on ''
      clean[field] = readCredential(entry[field], `${path}.${field}`) ?? '';
    }
    if (provider === 'apple') {
      for (const field of OAUTH_APPLE_CREDENTIALS) {
        if (entry[field] !== undefined) {
          clean[field] = readCredential(entry[field], `${path}.${field}`);
        }
      }
    }
    // hasClientSecret / hasPrivateKey are read-only flags and are ignored if echoed back
    result[provider] = clean;
  }
  return result;
}

/** The boolean `flags` that are set on `record`, validated. */
function readFlags(record: Record_, flags: readonly string[], path: string): Record_ {
  const clean: Record_ = {};
  for (const flag of flags) {
    if (record[flag] !== undefined) {
      clean[flag] = readBoolean(record[flag], `${path}.${flag}`);
    }
  }
  return clean;
}

function sanitizeGuests(value: unknown): Record_ {
  const guests = readRecord(value, 'policies.guests');
  const clean = readFlags(guests, ['allowed', 'directSignIn'], 'policies.guests');
  if (guests.allowedHomeRealms !== undefined) {
    const realms = readStringList(
      guests.allowedHomeRealms,
      'policies.guests.allowedHomeRealms',
    );
    if (!realms.every(isRealmId)) {
      fail('policies.guests.allowedHomeRealms must contain realm team ids');
    }
    clean.allowedHomeRealms = realms;
  }
  return clean;
}

function sanitizePolicies(value: unknown): Record_ {
  const policies = readRecord(value, 'policies');
  const clean = readFlags(policies, ['requireTwoFa', 'requireVerifiedEmail'], 'policies');
  if (policies.allowedClientIds !== undefined) {
    clean.allowedClientIds = readStringList(
      policies.allowedClientIds,
      'policies.allowedClientIds',
    );
  }
  if (policies.guests !== undefined) clean.guests = sanitizeGuests(policies.guests);
  return clean;
}

function sanitizeStrategyToggle(key: (typeof STRATEGY_TOGGLES)[number], value: unknown) {
  const entry = readRecord(value, `strategies.${key}`);
  const clean = readFlags(entry, ['enabled'], `strategies.${key}`);
  if (key === 'local' && entry.verificationRequired !== undefined) {
    // null = inherit the global verification setting again
    clean.verificationRequired =
      entry.verificationRequired === null
        ? null
        : readBoolean(
            entry.verificationRequired,
            'strategies.local.verificationRequired',
          );
  }
  return clean;
}

function sanitizeStrategies(value: unknown): Record_ {
  const strategies = readRecord(value, 'strategies');
  const clean: Record_ = {};
  for (const key of STRATEGY_TOGGLES) {
    if (strategies[key] === undefined) continue;
    clean[key] = sanitizeStrategyToggle(key, strategies[key]);
  }
  if (strategies.oauth !== undefined) clean.oauth = sanitizeOAuth(strategies.oauth);
  return clean;
}

/**
 * Validates and whitelists the write body of POST/PATCH `/teams/:teamId/realm`
 * (`slug` and `force` are handled by the caller and ignored here). Wrong types throw
 * INVALID_ARGUMENT; unknown keys are dropped.
 * Credential clearing: an OAuth credential sent as `null` (or a blank string) means
 * "clear it", which this function expresses as `null` for plain credentials (see
 * mergeRealmSettings) and as `''` for secrets (see applyOAuthSecretsUpdate).
 */
export function sanitizeRealmInput(body: unknown): RealmSettingsInput {
  if (body === undefined || body === null) return {};
  const input = readRecord(body, 'body');
  const result: Record_ = {};
  if (input.active !== undefined) result.active = readBoolean(input.active, 'active');
  if (input.registration !== undefined) {
    const registration = readRecord(input.registration, 'registration');
    result.registration = readFlags(registration, ['allowWithoutInvite'], 'registration');
  }
  if (input.policies !== undefined) result.policies = sanitizePolicies(input.policies);
  if (input.linking !== undefined) {
    const linking = readRecord(input.linking, 'linking');
    result.linking = readFlags(linking, ['inbound', 'outbound'], 'linking');
  }
  if (input.strategies !== undefined) {
    result.strategies = sanitizeStrategies(input.strategies);
  }
  return result as RealmSettingsInput;
}

/**
 * Deep merge for realm settings: plain objects merge recursively, arrays and scalars
 * replace, and `null` is kept as an explicit `null` leaf (the value falls back to its
 * default or to the global configuration). The key is NOT deleted: nested objects are
 * flattened columns on SQL and a write only touches the leaves it defines, so a deleted
 * key would silently keep the old value there. Readers treat `null` as unset. Neither
 * input is mutated.
 */
export function deepMergeClearing<T extends Indexable>(base: T, patch: Indexable): T {
  const result: Indexable = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (value === null) {
      result[key] = null;
    } else if (isRecord(value) && isRecord(result[key])) {
      result[key] = deepMergeClearing(result[key], value);
    } else if (isRecord(value)) {
      result[key] = deepMergeClearing({}, value);
    } else if (Array.isArray(value)) {
      result[key] = [...value];
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

export type RealmSettingsFields = Omit<StoredRealmSettingsData, 'oauthSecrets'>;

/** The settings fields of a stored document, with SQL array shapes normalized. */
export function pickSettingsFields(stored: Indexable): RealmSettingsFields {
  const policies = stored.policies ?? {};
  return {
    active: stored.active !== false,
    strategies: JSON.parse(JSON.stringify(stored.strategies ?? { oauth: {} })),
    registration: {
      allowWithoutInvite: stored.registration?.allowWithoutInvite === true,
    },
    policies: {
      requireTwoFa: policies.requireTwoFa === true,
      requireVerifiedEmail: policies.requireVerifiedEmail === true,
      allowedClientIds: normalizeIdList(policies.allowedClientIds),
      guests: {
        allowed: policies.guests?.allowed !== false,
        allowedHomeRealms: normalizeIdList(policies.guests?.allowedHomeRealms),
        directSignIn: directSignInOf(policies.guests),
      },
    },
    linking: linkingFlagsOf(stored.linking),
  };
}

/**
 * Rejects credential sets that cannot work, for the providers a write touches (a
 * provider the write leaves alone is not re-validated, so stored legacy data never
 * blocks unrelated changes). The inputs are the merged result, so a stored secret
 * counts when the write omits it:
 *  - `clientId` and `clientSecret` are a pair (every provider but Apple, which signs a
 *    secret from its key triple): a realm that sets its own `clientId` must have its own
 *    `clientSecret`, the secret is never inherited from global in that case. A write
 *    that supplies a `clientSecret` without any `clientId` is refused as well (a stored
 *    secret left behind by clearing the `clientId` is tolerated: it is ignored and both
 *    credentials inherit from global);
 *  - Apple's key triple (`privateKey`, `teamId`, `keyId`) is all-or-nothing.
 * A provider that stays disabled and whose credentials the write does not touch is
 * skipped; the check runs when it is enabled.
 */
export function assertOAuthCredentialsConsistent(params: {
  oauth: Record<string, Indexable | undefined>;
  secrets: RealmOAuthSecrets;
  patchOauth: Record<string, Indexable | undefined>;
  secretsUpdate: RealmOAuthSecrets;
}): void {
  const { oauth, secrets, patchOauth, secretsUpdate } = params;
  for (const provider of Object.keys(patchOauth)) {
    const entry = oauth[provider] ?? {};
    const patch = patchOauth[provider] ?? {};
    const update = (secretsUpdate as Record<string, Indexable | undefined>)[provider];
    const touchesCredentials =
      ['clientId', 'teamId', 'keyId'].some(field => patch[field] !== undefined) ||
      update?.clientSecret !== undefined ||
      update?.privateKey !== undefined;
    if (entry.enabled !== true && !touchesCredentials) continue;
    const stored = (secrets as Record<string, Indexable | undefined>)[provider] ?? {};
    if (provider === 'apple') {
      const set = [stored.privateKey, entry.teamId, entry.keyId].filter(filled).length;
      if (set !== 0 && set !== 3) {
        fail(
          `strategies.oauth.apple: privateKey, teamId and keyId must be set together (all three or none, to inherit the global key)`,
        );
      }
      continue;
    }
    const hasClientId = filled(entry.clientId);
    const hasSecret = filled(stored.clientSecret);
    if (hasClientId && !hasSecret) {
      fail(
        `strategies.oauth.${provider}: clientId requires its own clientSecret (the secret is never inherited from the global configuration)`,
      );
    }
    if (!hasClientId && filled(update?.clientSecret)) {
      fail(
        `strategies.oauth.${provider}: clientSecret requires a clientId (credentials are a pair)`,
      );
    }
  }
}

/**
 * Applies a write body to a base: the defaults for a promotion, the stored settings and
 * secrets for a PATCH. Returns what to store. Throws INVALID_ARGUMENT for credential sets
 * that cannot work (see `assertOAuthCredentialsConsistent`).
 */
export function buildRealmSettingsWrite(params: {
  base: Indexable;
  baseSecrets?: RealmOAuthSecrets | null;
  input: unknown;
  /**
   * GitOps import: secrets are never exported, so a realm with its own `clientId` is
   * imported before its secret exists. The pair is then incomplete, which is safe (the
   * provider fails closed at request time) until the secret is set.
   */
  allowIncompleteCredentials?: boolean;
}): { settings: RealmSettingsFields; oauthSecrets: RealmOAuthSecrets } {
  const { settings: patch, oauthSecrets: secretsUpdate } = splitRealmSettingsInput(
    sanitizeRealmInput(params.input),
  );
  const settings = deepMergeClearing(pickSettingsFields(params.base), patch);
  settings.strategies.oauth = settings.strategies.oauth ?? {};
  // a provider entry that was never switched on stays off (the toggle is explicit)
  for (const entry of Object.values(settings.strategies.oauth) as Indexable[]) {
    if (entry && typeof entry === 'object' && entry.enabled === undefined) {
      entry.enabled = false;
    }
  }
  const oauthSecrets = applyOAuthSecretsUpdate(params.baseSecrets, secretsUpdate);
  if (!params.allowIncompleteCredentials) {
    assertOAuthCredentialsConsistent({
      oauth: settings.strategies.oauth as Record<string, Indexable | undefined>,
      secrets: oauthSecrets,
      patchOauth: (patch.strategies?.oauth ?? {}) as Record<
        string,
        Indexable | undefined
      >,
      secretsUpdate,
    });
  }
  return { settings, oauthSecrets };
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

/** Contract `Realm`: the team, its settings with secrets masked and the user counts. */
export function toRealmDto<
  S extends { strategies: { oauth?: Record<string, any> }; oauthSecrets?: unknown },
>(team: Indexable, settings: S, counts: { home: number; guest: number }) {
  const withDefaults = withRealmFieldDefaults(settings) as S;
  return { team, settings: maskRealmSettings(withDefaults), counts };
}

/** Adds the realm team role and the membership type to a user, for the members list. */
export function toRealmMember<T extends Indexable>(
  user: T,
  role: string | undefined,
  membershipType: 'home' | 'guest' | undefined,
): T & { role?: string; membershipType?: 'home' | 'guest' } {
  return {
    ...user,
    ...(role ? { role } : {}),
    ...(membershipType ? { membershipType } : {}),
  };
}
