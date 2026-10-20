import { GrpcError, Indexable } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';

/*
 * Pure decisions of the discovery login (no database or grpc access). A discovery login
 * checks the credentials against every account holding the identifier and answers the
 * realms whose account accepted them, plus a proof token that the link routes consume. IO
 * lives in ./realmDiscovery.ts.
 */

/** Accounts read per discovery lookup; more holders than this are not listed. */
export const DISCOVERY_MAX_ACCOUNTS = 50;

/** Lifetime of a link proof token. */
export const REALM_LINK_PROOF_TTL_MS = 10 * 60 * 1000;

/** One listed realm. `slug` and `name` are null for a global account. */
export type DiscoveryRealmEntry = {
  slug: string | null;
  name: string | null;
  requiresTwoFa?: true;
};

export type DiscoveryAnswer = {
  realms: DiscoveryRealmEntry[];
  proofToken?: string;
};

/** A proof entry: the account of one realm (null = global) that the credentials matched. */
export type ProofEntry = { realmId: string | null; userId: string };

/** An account that accepted the credentials, with what the answer needs to know of it. */
export type DiscoveryAccount = {
  userId: string;
  realmId: string | null;
  slug: string | null;
  name: string | null;
  hasTwoFA: boolean;
};

/**
 * Why a discovery request is refused, or null when it may proceed.
 *  - discovery is off (`teams.realms.discoveryLogin` or realms): INVALID_ARGUMENT;
 *  - `discover` and `realm` name a realm at once: they are mutually exclusive;
 *  - an invitation token has no meaning for a login.
 */
export function discoveryRequestError(params: {
  discover: boolean;
  enabled: boolean;
  realm?: unknown;
  invitationToken?: unknown;
}): string | null {
  if (!params.discover) return null;
  if (!params.enabled) return 'Discovery login is not enabled';
  if (params.realm !== undefined && params.realm !== null && params.realm !== '') {
    return 'discover and realm are mutually exclusive';
  }
  if (params.invitationToken !== undefined && params.invitationToken !== null) {
    return 'discover does not accept an invitation token';
  }
  return null;
}

/** Throws INVALID_ARGUMENT for a discovery request that the rules above refuse. */
export function assertDiscoveryRequestAllowed(params: {
  discover: boolean;
  enabled: boolean;
  realm?: unknown;
  invitationToken?: unknown;
}): void {
  const message = discoveryRequestError(params);
  if (message) throw new GrpcError(status.INVALID_ARGUMENT, message);
}

/**
 * Whether one account accepts a discovery login. The account must be active and its home
 * realm must enable the strategy. A password login also needs a password hash that matches,
 * and a passed verification when the home realm requires it (the same rule as the password
 * check of a login). A refused account is simply not listed.
 */
export function isDiscoveryAccepted(facts: {
  active: boolean;
  strategyEnabledAtHome: boolean;
  password?: {
    hashed: boolean;
    matches: boolean;
    verificationRequired: boolean;
    isVerified: boolean;
  };
}): boolean {
  if (!facts.active || !facts.strategyEnabledAtHome) return false;
  const password = facts.password;
  if (!password) return true;
  if (!password.hashed || !password.matches) return false;
  return !(password.verificationRequired && !password.isVerified);
}

/**
 * The answer's realm list and the proof entries, from the accounts that accepted.
 *  - one realm is listed once (a realm holds one account per identifier; a second match for
 *    the same realm is dropped, and when the two disagree on 2FA the realm is listed as
 *    requiring it, the conservative answer);
 *  - an account with 2FA is listed with `requiresTwoFa` and gets no proof entry: its realm is
 *    entered by a normal sign-in with the second factor.
 */
export function buildDiscoveryAnswer(accounts: readonly DiscoveryAccount[]): {
  realms: DiscoveryRealmEntry[];
  proofEntries: ProofEntry[];
} {
  const realms: DiscoveryRealmEntry[] = [];
  const proofEntries: ProofEntry[] = [];
  const seen = new Map<string, DiscoveryRealmEntry>();
  for (const account of accounts) {
    const key = account.realmId ?? '\u0000global';
    const existing = seen.get(key);
    if (existing) {
      if (account.hasTwoFA && !existing.requiresTwoFa) {
        existing.requiresTwoFa = true;
        const realmId = account.realmId ?? null;
        const index = proofEntries.findIndex(entry => entry.realmId === realmId);
        if (index >= 0) proofEntries.splice(index, 1);
      }
      continue;
    }
    const entry: DiscoveryRealmEntry = {
      slug: account.slug ?? null,
      name: account.name ?? null,
      ...(account.hasTwoFA ? { requiresTwoFa: true as const } : {}),
    };
    seen.set(key, entry);
    realms.push(entry);
    if (!account.hasTwoFA) {
      proofEntries.push({ realmId: account.realmId ?? null, userId: account.userId });
    }
  }
  return { realms, proofEntries };
}

/** The `data` of a link proof token issued at `now` (epoch milliseconds). */
export function linkProofData(
  entries: readonly ProofEntry[],
  now: number,
): { entries: ProofEntry[]; expiresAt: number } {
  return {
    entries: entries.map(entry => ({
      realmId: entry.realmId ?? null,
      userId: String(entry.userId),
    })),
    expiresAt: now + REALM_LINK_PROOF_TTL_MS,
  };
}

/** Whether a proof token's data is still within its lifetime at `now`. */
export function isLinkProofLive(
  data: { expiresAt?: unknown } | null | undefined,
  now: number,
): boolean {
  const expiresAt = Number(data?.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > now;
}

/**
 * The account a proof token vouches for at `sourceRealmId` (null = global): the live token
 * must hold an entry for that realm. Null when the token is expired or has no such entry.
 * Pure; the single use is the caller's `consumeLinkProof`.
 */
export function decideLinkProofUse(
  data: { entries?: unknown; expiresAt?: unknown } | null | undefined,
  sourceRealmId: string | null,
  now: number,
): { userId: string } | null {
  if (!data || !isLinkProofLive(data, now)) return null;
  const entries = Array.isArray(data.entries) ? (data.entries as Indexable[]) : [];
  const wanted = sourceRealmId ? String(sourceRealmId) : null;
  const entry = entries.find(
    candidate =>
      (candidate?.realmId ? String(candidate.realmId) : null) === wanted &&
      typeof candidate?.userId === 'string' &&
      candidate.userId !== '',
  );
  return entry ? { userId: String(entry.userId) } : null;
}

/** Whether a conditional delete of the proof token removed it (the single use). */
export function isProofConsumed(
  result: { deletedCount: number } | null | undefined,
): boolean {
  return (result?.deletedCount ?? 0) > 0;
}

/**
 * The query that finds the accounts an OAuth provider identity may belong to: holders of the
 * provider id, or of the email the provider verified. Null when the payload has neither.
 */
export function oauthDiscoveryFilter(
  provider: string,
  identity: { id?: unknown; email?: unknown },
): Indexable | null {
  const clauses: Indexable[] = [];
  const id = identity.id;
  if ((typeof id === 'string' && id !== '') || typeof id === 'number') {
    clauses.push({ [`${provider}.id`]: String(id) });
  }
  if (typeof identity.email === 'string' && identity.email !== '') {
    clauses.push({ email: identity.email });
  }
  return clauses.length > 0 ? { $or: clauses } : null;
}

/**
 * The redirect of an OAuth discovery: the validated redirect URI with the listed realms as
 * base64url JSON in `realms`, and the proof token in `proofToken` when there is one.
 */
export function discoveryRedirectUrl(
  redirectUri: string,
  answer: DiscoveryAnswer,
): string {
  const url = new URL(redirectUri);
  url.searchParams.set(
    'realms',
    Buffer.from(JSON.stringify(answer.realms)).toString('base64url'),
  );
  if (answer.proofToken) url.searchParams.set('proofToken', answer.proofToken);
  return url.toString();
}
