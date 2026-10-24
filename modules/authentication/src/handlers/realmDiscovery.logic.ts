import { GrpcError, Indexable } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';

/*
 * Pure decisions of the discovery login (no database or grpc access). A discovery login
 * checks the credentials against every account holding the identifier and answers the
 * realms whose account accepted them, plus a proof token that the link routes consume. IO
 * lives in ./realmDiscovery.ts.
 */

/** Accounts read per discovery lookup (phone and OAuth); more holders than this are not listed. */
export const DISCOVERY_MAX_ACCOUNTS = 50;

/**
 * Accounts checked per password discovery (local and username). Each check is a bcrypt
 * compare, so this bounds the work one request can cause; more holders are not listed.
 */
export const DISCOVERY_PASSWORD_MAX_ACCOUNTS = 15;

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

/**
 * The `data` of a link proof token issued at `now` (epoch milliseconds) to the client that ran
 * the discovery. The proof is usable only by that client (see decideLinkProofUse).
 */
export function linkProofData(
  entries: readonly ProofEntry[],
  now: number,
  clientId: string,
): { entries: ProofEntry[]; expiresAt: number; clientId: string } {
  return {
    entries: entries.map(entry => ({
      realmId: entry.realmId ?? null,
      userId: String(entry.userId),
    })),
    expiresAt: now + REALM_LINK_PROOF_TTL_MS,
    clientId: String(clientId),
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
 * The account a proof token vouches for at `sourceRealmId` (null = global), for the client
 * `clientId` of the link request. The live token must hold an entry for that realm and must
 * have been issued to the same client; otherwise null (expired, no entry, another client, or
 * no client). Pure; the single use is the caller's `consumeLinkProof`.
 */
export function decideLinkProofUse(
  data: { entries?: unknown; expiresAt?: unknown; clientId?: unknown } | null | undefined,
  sourceRealmId: string | null,
  now: number,
  clientId: string | null | undefined,
): { userId: string } | null {
  if (!data || !isLinkProofLive(data, now)) return null;
  if (typeof data.clientId !== 'string' || data.clientId === '') return null;
  if (!clientId || String(clientId) !== data.clientId) return null;
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

/** The email of an OAuth identity in the form it is stored and compared (lower case). */
function normalizedEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null;
  const value = email.trim().toLowerCase();
  return value === '' ? null : value;
}

/**
 * The query that finds the accounts an OAuth provider identity may belong to: holders of the
 * provider id, or of the email the payload carries (lower-cased, as accounts store it). Null
 * when the payload has neither. The email is not proof of ownership by itself: see
 * oauthAccountListed for when an email-only match counts.
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
  const email = normalizedEmail(identity.email);
  if (email) clauses.push({ email });
  return clauses.length > 0 ? { $or: clauses } : null;
}

/** How one account matches an OAuth identity: by its provider id, by its email, or both. */
export type OAuthAccountMatch = { byId: boolean; byEmail: boolean };

/**
 * Whether an account matches the identity by the provider id (`account.providerId` is the
 * account's stored id for the provider) and/or by the email (case-insensitive).
 */
export function oauthAccountMatch(
  identity: { id?: unknown; email?: unknown },
  account: { providerId?: unknown; email?: unknown },
): OAuthAccountMatch {
  const id = identity.id;
  const byId =
    ((typeof id === 'string' && id !== '') || typeof id === 'number') &&
    account.providerId !== undefined &&
    account.providerId !== null &&
    String(account.providerId) === String(id);
  const email = normalizedEmail(identity.email);
  const byEmail = email !== null && normalizedEmail(account.email) === email;
  return { byId, byEmail };
}

/**
 * The linking setting that governs an account's email match: the realm's own
 * `accountLinking` for the provider when the account's home realm sets one, else the global
 * provider setting. A global account (no realm) uses the global setting.
 */
export function oauthAccountLinking(
  realmSetting: boolean | null | undefined,
  globalSetting: boolean,
): boolean {
  return realmSetting ?? !!globalSetting;
}

/**
 * Whether an account is listed by an OAuth discovery. A provider-id match always counts. An
 * email-only match counts only when account linking is allowed for the account's scope
 * (see oauthAccountLinking): the email is what the provider verified, but an account that
 * does not link by email must not be revealed through it.
 */
export function oauthAccountListed(
  match: OAuthAccountMatch,
  accountLinking: boolean,
): boolean {
  return match.byId || (match.byEmail && accountLinking);
}

/**
 * The redirect of an OAuth discovery: the validated redirect URI with the listed realms
 * (base64url JSON) and the proof token in the URL fragment, so that neither reaches server
 * logs or referrers as a query. The fragment keys are `realms` and `proofToken`.
 */
export function discoveryRedirectUrl(
  redirectUri: string,
  answer: DiscoveryAnswer,
): string {
  const url = new URL(redirectUri);
  const fragment = new URLSearchParams();
  fragment.set(
    'realms',
    Buffer.from(JSON.stringify(answer.realms)).toString('base64url'),
  );
  if (answer.proofToken) fragment.set('proofToken', answer.proofToken);
  url.hash = fragment.toString();
  return url.toString();
}
