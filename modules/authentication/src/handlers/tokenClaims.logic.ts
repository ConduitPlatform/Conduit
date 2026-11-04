import type { AccessTokenClaims } from '@conduitplatform/grpc-sdk';

/*
 * Pure assembly of the claims of a jwt-mode access token (no config, database or grpc
 * access): callers resolve the inputs and sign the result.
 */

/** At most this many direct team memberships travel in a token. */
export const MAX_TEAM_CLAIMS = 20;
export const TOKEN_ISSUER = 'conduit';

export type TeamClaim = { id: string; role: string };

const UUID_SID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether a session id is one of ours without a refresh row (a uuid, minted when no
 * refresh row exists). Refresh row ids are database ids, never uuids; such an id must
 * not be used as a row id (a MongoDB cast error) nor have its registry ttl shortened.
 */
export function isSyntheticSid(sid: string): boolean {
  return UUID_SID.test(String(sid));
}

/**
 * Direct memberships from authorization relations (`relation` is the role, `resource` is
 * `Team:<id>`). Callers request MAX_TEAM_CLAIMS + 1 relations: more than the cap means
 * the list is truncated. Relations on anything but a team are ignored; a team listed
 * twice keeps its first role. The relations are ordered by team id first, so the kept
 * 20 do not depend on the order the authorization module happened to answer in.
 */
export function teamClaimsFromRelations(
  relations: { relation: string; resource: string }[],
): { teams: TeamClaim[]; truncated: boolean } {
  const seen = new Set<string>();
  const teams: TeamClaim[] = [];
  const ordered = [...relations].sort((a, b) =>
    String(a.resource) < String(b.resource)
      ? -1
      : String(a.resource) > String(b.resource)
        ? 1
        : 0,
  );
  for (const { relation, resource } of ordered) {
    if (typeof resource !== 'string' || !resource.startsWith('Team:')) continue;
    const id = resource.slice('Team:'.length);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    teams.push({ id, role: relation });
  }
  return {
    teams: teams.slice(0, MAX_TEAM_CLAIMS),
    truncated: teams.length > MAX_TEAM_CLAIMS,
  };
}

/**
 * `home` when the realm is the user's home realm, else `guest` when a guest membership
 * exists. Global sessions (no realm) and an unresolvable relation carry no type.
 */
export function resolveRealmType(params: {
  realmId?: string | null;
  homeRealm?: string | null;
  hasGuestMembership?: boolean;
}): 'home' | 'guest' | undefined {
  const { realmId, homeRealm } = params;
  if (!realmId) return undefined;
  if (homeRealm && String(homeRealm) === String(realmId)) return 'home';
  if (params.hasGuestMembership) return 'guest';
  return undefined;
}

export interface BuildAccessTokenClaimsInput {
  userId: string;
  sessionId: string;
  clientId: string;
  /** realm team id; null/undefined for a global session */
  realmId?: string | null;
  realmSlug?: string;
  homeSlug?: string;
  homeRealm?: string | null;
  hasGuestMembership?: boolean;
  authorized: boolean;
  sudo: boolean;
  tokenVersion: number;
  /** undefined when the authorization module could not answer: the claim is left out */
  teams?: { teams: TeamClaim[]; truncated: boolean };
  /** epoch milliseconds */
  now: number;
  expiryMs: number;
}

/**
 * The exact claim set of a jwt access token:
 * sub, sid, cid, rid?, realm?, home?, rtype?, authorized, sudo, tv, teams?,
 * teamsTruncated? (only when true), iat, exp, iss.
 * Optional claims are omitted, never null.
 */
export function buildAccessTokenClaims(
  input: BuildAccessTokenClaimsInput,
): AccessTokenClaims {
  const iat = Math.floor(input.now / 1000);
  const rtype = resolveRealmType(input);
  const claims: AccessTokenClaims = {
    sub: String(input.userId),
    sid: String(input.sessionId),
    cid: input.clientId,
    ...(input.realmId ? { rid: String(input.realmId) } : {}),
    ...(input.realmSlug ? { realm: input.realmSlug } : {}),
    ...(input.homeSlug ? { home: input.homeSlug } : {}),
    ...(rtype ? { rtype } : {}),
    authorized: input.authorized,
    sudo: input.sudo,
    tv: input.tokenVersion,
    ...(input.teams ? { teams: input.teams.teams } : {}),
    ...(input.teams?.truncated ? { teamsTruncated: true } : {}),
    iat,
    exp: iat + Math.max(1, Math.floor(input.expiryMs / 1000)),
    iss: TOKEN_ISSUER,
  };
  return claims;
}
