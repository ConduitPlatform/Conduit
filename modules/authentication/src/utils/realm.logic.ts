import { GrpcError } from '@conduitplatform/grpc-sdk';
import { ModuleError } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { errors } from '../errors.js';

/*
 * Pure realm logic (no database or grpc access) so it can be unit tested like
 * emailRestrictions. IO lives in ./realm.ts, which re-exports everything here.
 */

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

export type RealmStrategies = {
  local: { enabled: boolean; verificationRequired?: boolean };
  username: { enabled: boolean };
  magicLink: { enabled: boolean };
  phone: { enabled: boolean };
  metamask: { enabled: boolean };
  biometric: { enabled: boolean };
  oauth: Partial<Record<RealmOAuthProviderKey, RealmOAuthStrategy>>;
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

export type RealmSettingsData = {
  active: boolean;
  strategies: RealmStrategies;
  registration: { allowWithoutInvite: boolean };
  policies: RealmPolicies;
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
 * Scopes a user lookup to a home realm. `null` (global) must match both `null` and
 * missing, same `$or` shape `admin/team.ts` uses for `parentTeam`.
 */
export function homeScopedQuery(realmId: string | null | undefined) {
  if (realmId) return { homeRealm: String(realmId) };
  return { $or: [{ homeRealm: null }, { homeRealm: { $exists: false } }] };
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
      allowedClientIds: [...(policies.allowedClientIds ?? [])],
      guests: {
        allowed: policies.guests?.allowed ?? defaults.policies.guests.allowed,
        allowedHomeRealms: (policies.guests?.allowedHomeRealms ?? []).map(String),
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
  if (!policies.guests?.allowed) {
    return { allowed: false, error: 'GUESTS_NOT_ALLOWED' };
  }
  const trusted = (policies.guests.allowedHomeRealms ?? []).map(String);
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
  const clients = policies.allowedClientIds ?? [];
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
