import { EffectiveAuthSettings, REALM_OAUTH_PROVIDERS } from '../utils/realm.logic.js';

/*
 * Pure response builders of the client realm routes (no database or grpc access). IO
 * lives in ./realm.ts.
 */

export type RealmPolicySummary = {
  requireTwoFa: boolean;
  requireVerifiedEmail: boolean;
};

export type RealmDiscovery = {
  name: string;
  slug: string;
  strategies: {
    local: boolean;
    username: boolean;
    magicLink: boolean;
    phone: boolean;
    metamask: boolean;
    biometric: boolean;
    oauth: string[];
  };
  policies: RealmPolicySummary & { guestsAllowed: boolean };
};

export type RealmRef = { _id: string; name: string; slug: string };

export type UserRealms = {
  home: { team: RealmRef } | null;
  guests: { team: RealmRef; policies: RealmPolicySummary }[];
};

export function summarizePolicies(
  policies: Pick<
    EffectiveAuthSettings['policies'],
    'requireTwoFa' | 'requireVerifiedEmail'
  >,
): RealmPolicySummary {
  return {
    requireTwoFa: policies.requireTwoFa === true,
    requireVerifiedEmail: policies.requireVerifiedEmail === true,
  };
}

/** Public, secret-free description of a realm: what a client needs to build its login. */
export function buildRealmDiscovery(
  team: { name: string; realm?: { enabled?: boolean; slug?: string } | null },
  effective: Pick<EffectiveAuthSettings, 'strategies' | 'policies'>,
): RealmDiscovery {
  const { strategies, policies } = effective;
  return {
    name: team.name,
    slug: team.realm?.slug ?? '',
    strategies: {
      local: strategies.local.enabled,
      username: strategies.username.enabled,
      magicLink: strategies.magicLink.enabled,
      phone: strategies.phone.enabled,
      metamask: strategies.metamask.enabled,
      biometric: strategies.biometric.enabled,
      oauth: REALM_OAUTH_PROVIDERS.filter(
        provider => strategies.oauth[provider]?.enabled === true,
      ),
    },
    policies: {
      ...summarizePolicies(policies),
      guestsAllowed: policies.guests.allowed,
    },
  };
}

export function toRealmRef(team: {
  _id: unknown;
  name: string;
  realm?: { enabled?: boolean; slug?: string } | null;
}): RealmRef {
  return { _id: String(team._id), name: team.name, slug: team.realm?.slug ?? '' };
}

/**
 * The user's realms: their home realm and their guest memberships. A realm that could
 * not be resolved (inactive, demoted) is left out. The home realm is never listed as a
 * guest realm.
 */
export function buildUserRealms(params: {
  homeRealmId: string | null;
  home: { team: RealmRef } | null;
  guests: { team: RealmRef; policies: RealmPolicySummary }[];
}): UserRealms {
  const home = params.homeRealmId ? params.home : null;
  return {
    home,
    guests: params.guests.filter(guest => guest.team._id !== params.homeRealmId),
  };
}
