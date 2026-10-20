import { EffectiveAuthSettings, REALM_OAUTH_PROVIDERS } from '../utils/realm.logic.js';
import { decideLinkProofUse } from './realmDiscovery.logic.js';
import { isHomeRealm } from './realmRequest.logic.js';

/*
 * Pure response builders and decisions of the client realm routes (no database or grpc
 * access). IO lives in ./realm.ts.
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

/**
 * Token flags of `POST /realms/:slug/enter`. A new session in a realm must not be more
 * privileged than the one used to enter: sudo is only carried over when the entering
 * token itself has it (which in turn requires a passed 2FA), and the 2FA state is
 * inherited from it.
 */
export function enterRealmTokenFlags(
  jwtPayload: { sudo?: unknown; authorized?: unknown } | null | undefined,
): { noSudo: boolean; twoFaPass: boolean } {
  return { noSudo: !jwtPayload?.sudo, twoFaPass: !!jwtPayload?.authorized };
}

/** The session of the link's source account, as the link route reads it. */
export type LinkSession = {
  userId: string;
  homeRealmId: string | null;
  anonymous: boolean;
  authorized: boolean;
};

/** The account a link is made for, and how it was proven. */
export type LinkSource = {
  flow: 'proof' | 'session';
  userId: string;
  sourceRealmId: string | null;
};

/**
 * Which account a link is for, or null (INVALID_LINK_PROOF). `sourceRealm` is the named source
 * realm id (null for the global scope), or undefined when none was named.
 *  - a proof token wins: its live entry for the named source realm (global when none was named),
 *    issued to the same client as the link request;
 *  - else an authenticated session: fully authorized, not anonymous, and whose home realm is the
 *    named source realm (any home when none was named).
 */
export function selectLinkSource(params: {
  proof?: { entries?: unknown; expiresAt?: unknown; clientId?: unknown } | null;
  clientId: string | null | undefined;
  sourceRealm: string | null | undefined;
  now: number;
  session: LinkSession | null;
}): LinkSource | null {
  const sourceRealmId = params.sourceRealm ?? null;
  if (params.proof) {
    const use = decideLinkProofUse(
      params.proof,
      sourceRealmId,
      params.now,
      params.clientId,
    );
    if (use) return { flow: 'proof', userId: use.userId, sourceRealmId };
  }
  const session = params.session;
  if (!session || session.anonymous || !session.authorized) return null;
  if (params.sourceRealm !== undefined && params.sourceRealm !== session.homeRealmId) {
    return null;
  }
  return { flow: 'session', userId: session.userId, sourceRealmId: session.homeRealmId };
}

/**
 * Whether a link may still proceed for the account as it is at the link: it must still be
 * homed in the source realm the link was proven for (it may have moved home since), and a proof
 * is not used by an account that has gained 2FA since the proof was issued.
 */
export function linkSourceStillValid(params: {
  flow: 'proof' | 'session';
  sourceRealmId: string | null;
  homeRealmId: string | null;
  hasTwoFA: boolean;
}): boolean {
  if ((params.homeRealmId ?? null) !== (params.sourceRealmId ?? null)) return false;
  return !(params.flow === 'proof' && params.hasTwoFA);
}

/**
 * Whether leaving a realm is refused: the home realm of a user is never left (the user is moved
 * or blocked instead). Only guest realms can be left.
 */
export function isLeaveRefused(homeRealm: unknown, targetRealmId: string): boolean {
  return isHomeRealm(homeRealm, targetRealmId);
}

/**
 * The teams whose relations of the user are removed when a realm is left: the sub-teams of the
 * realm, not the realm team itself. Its relation goes with the membership (see
 * revokeRealmMembership with removeRelations), so removing it again would be a duplicate.
 */
export function subteamIdsOnLeave(
  realmTeamId: string,
  subtreeIds: readonly string[],
): string[] {
  const root = String(realmTeamId);
  return subtreeIds.map(String).filter(id => id !== root);
}
