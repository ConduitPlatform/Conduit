import { GrpcError, Indexable } from '@conduitplatform/grpc-sdk';
import { ModuleError } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { errors } from '../errors.js';
import {
  applyOAuthSecretsUpdate,
  evaluateGuestAllowed,
  isRealmId,
  maskRealmSettings,
  normalizeIdList,
  normalizeSlug,
  REALM_OAUTH_PROVIDERS,
  RealmOAuthSecrets,
  RealmPolicies,
  RealmSettingsInput,
  splitRealmSettingsInput,
  StoredRealmSettingsData,
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

function isRecord(value: unknown): value is Record_ {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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
const OAUTH_SECRET_FIELDS = ['clientSecret', 'privateKey'] as const;

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
    result.registration = {};
    if (registration.allowWithoutInvite !== undefined) {
      result.registration.allowWithoutInvite = readBoolean(
        registration.allowWithoutInvite,
        'registration.allowWithoutInvite',
      );
    }
  }
  if (input.policies !== undefined) {
    const policies = readRecord(input.policies, 'policies');
    const clean: Record_ = {};
    for (const flag of ['requireTwoFa', 'requireVerifiedEmail'] as const) {
      if (policies[flag] !== undefined) {
        clean[flag] = readBoolean(policies[flag], `policies.${flag}`);
      }
    }
    if (policies.allowedClientIds !== undefined) {
      clean.allowedClientIds = readStringList(
        policies.allowedClientIds,
        'policies.allowedClientIds',
      );
    }
    if (policies.guests !== undefined) {
      const guests = readRecord(policies.guests, 'policies.guests');
      clean.guests = {};
      if (guests.allowed !== undefined) {
        clean.guests.allowed = readBoolean(guests.allowed, 'policies.guests.allowed');
      }
      if (guests.allowedHomeRealms !== undefined) {
        const realms = readStringList(
          guests.allowedHomeRealms,
          'policies.guests.allowedHomeRealms',
        );
        if (!realms.every(isRealmId)) {
          fail('policies.guests.allowedHomeRealms must contain realm team ids');
        }
        clean.guests.allowedHomeRealms = realms;
      }
    }
    result.policies = clean;
  }
  if (input.strategies !== undefined) {
    const strategies = readRecord(input.strategies, 'strategies');
    const clean: Record_ = {};
    for (const key of STRATEGY_TOGGLES) {
      if (strategies[key] === undefined) continue;
      const entry = readRecord(strategies[key], `strategies.${key}`);
      clean[key] = {};
      if (entry.enabled !== undefined) {
        clean[key].enabled = readBoolean(entry.enabled, `strategies.${key}.enabled`);
      }
      if (key === 'local' && entry.verificationRequired !== undefined) {
        // null = inherit the global verification setting again
        clean[key].verificationRequired =
          entry.verificationRequired === null
            ? null
            : readBoolean(
                entry.verificationRequired,
                'strategies.local.verificationRequired',
              );
      }
    }
    if (strategies.oauth !== undefined) clean.oauth = sanitizeOAuth(strategies.oauth);
    result.strategies = clean;
  }
  return result as RealmSettingsInput;
}

/**
 * Deep merge for realm settings: plain objects merge recursively, arrays and scalars
 * replace, and `null` removes the key (so the value falls back to its default or to the
 * global configuration). Neither input is mutated.
 */
export function deepMergeClearing<T extends Indexable>(base: T, patch: Indexable): T {
  const result: Indexable = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (value === null) {
      delete result[key];
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
      },
    },
  };
}

/**
 * Applies a write body to a base: the defaults for a promotion, the stored settings and
 * secrets for a PATCH. Returns what to store.
 */
export function buildRealmSettingsWrite(params: {
  base: Indexable;
  baseSecrets?: RealmOAuthSecrets | null;
  input: unknown;
}): { settings: RealmSettingsFields; oauthSecrets: RealmOAuthSecrets } {
  const { settings: patch, oauthSecrets: secretsUpdate } = splitRealmSettingsInput(
    sanitizeRealmInput(params.input),
  );
  const settings = deepMergeClearing(pickSettingsFields(params.base), patch);
  settings.strategies.oauth = settings.strategies.oauth ?? {};
  return {
    settings,
    oauthSecrets: applyOAuthSecretsUpdate(params.baseSecrets, secretsUpdate),
  };
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

/** Contract `Realm`: the team, its settings with secrets masked and the user counts. */
export function toRealmDto<
  S extends { strategies: { oauth?: Record<string, any> }; oauthSecrets?: unknown },
>(team: Indexable, settings: S, counts: { home: number; guest: number }) {
  return { team, settings: maskRealmSettings(settings), counts };
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
