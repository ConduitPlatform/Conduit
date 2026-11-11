import {
  ConduitGrpcSdk,
  FindRelationRequest,
  parseErrorPayload,
} from '@conduitplatform/grpc-sdk';
import {
  MAX_TEAM_CLAIMS,
  TeamClaim,
  teamClaimsFromRelations,
} from '../handlers/tokenClaims.logic.js';
import { getRedisKeyValue, RedisKeyValuePort } from './sessionServices.js';

/** Redis key of a user's cached direct team memberships. */
export const teamClaimsKey = (userId: string) => `auth_teams_${userId}`;
export const TEAM_CLAIMS_TTL_MS = 60_000;
const REDIS_TIMEOUT_MS = 500;

type TeamClaimsRedis = Pick<RedisKeyValuePort, 'get' | 'set' | 'del'>;

export interface TeamClaimsResult {
  teams: TeamClaim[];
  truncated: boolean;
}

export interface TeamClaimsDeps {
  /** direct `User -> Team` relations of the user, at most `limit` of them */
  findRelations: (
    request: FindRelationRequest,
  ) => Promise<{ relations: { relation: string; resource: string }[] } | undefined>;
  redis?: () => TeamClaimsRedis | undefined;
  warn?: (message: string) => void;
}

function bounded<T>(op: () => Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('redis timeout')), REDIS_TIMEOUT_MS);
  });
  let pending: Promise<T>;
  try {
    pending = op();
  } catch (e) {
    clearTimeout(timer!);
    return Promise.reject(e);
  }
  return Promise.race([pending, timeout]).finally(() => clearTimeout(timer));
}

function parseCached(raw: string | null): TeamClaimsResult | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || !Array.isArray(value.teams)) return null;
    return { teams: value.teams, truncated: value.truncated === true };
  } catch {
    return null;
  }
}

let warnedUnavailable = false;
// bumped by every invalidation: a lookup that started before one must not write its
// (possibly stale) result back into the cache
let generation = 0;

/** Test hook: the "authorization unavailable" warning is logged once per process. */
export function resetTeamClaimsWarning() {
  warnedUnavailable = false;
}

/**
 * Direct team memberships of a user for the access token `teams` claim, capped at 20
 * (`truncated` when more exist; 21 relations are requested to tell). Cached in Redis for
 * 60 s under `auth_teams_<userId>`; `invalidateTeamClaims` drops it on every membership
 * or role change.
 *
 * Returns undefined (mint without teams) when the authorization module cannot answer.
 * That is logged once, until it answers again. A failed lookup is never cached; a Redis
 * failure only costs the cache.
 */
export async function loadTeamClaims(
  userId: string,
  deps: TeamClaimsDeps,
): Promise<TeamClaimsResult | undefined> {
  const warn = deps.warn ?? ((m: string) => ConduitGrpcSdk.Logger.warn(m));
  const redis = deps.redis ? deps.redis() : getRedisKeyValue();
  const key = teamClaimsKey(userId);
  const startedAt = generation;
  if (redis) {
    try {
      const cached = parseCached(await bounded(() => redis.get(key)));
      if (cached) return cached;
    } catch {
      // cache miss
    }
  }
  let response: Awaited<ReturnType<TeamClaimsDeps['findRelations']>>;
  try {
    response = await deps.findRelations({
      subject: 'User:' + userId,
      resourceType: 'Team',
      limit: MAX_TEAM_CLAIMS + 1,
    });
  } catch (e) {
    if (!warnedUnavailable) {
      warnedUnavailable = true;
      warn(
        `Authorization unavailable, access tokens are minted without teams: ${parseErrorPayload(e).message || String(e)}`,
      );
    }
    return undefined;
  }
  warnedUnavailable = false;
  const result = teamClaimsFromRelations(response?.relations ?? []);
  if (redis && startedAt === generation) {
    try {
      await bounded(() =>
        redis.set(key, JSON.stringify(result), 'PX', TEAM_CLAIMS_TTL_MS),
      );
    } catch {
      // best effort
    }
  }
  return result;
}

/** Drops the cached team claims of the users. Never throws. */
export async function invalidateTeamClaims(
  userIds: (string | undefined | null)[],
  redis: TeamClaimsRedis | undefined = getRedisKeyValue(),
): Promise<void> {
  const ids = Array.from(new Set(userIds.filter(Boolean).map(String)));
  if (ids.length === 0) return;
  generation += 1;
  if (!redis) return;
  // one DEL per key keeps this cluster-safe (keys hash to different slots)
  for (let i = 0; i < ids.length; i += 100) {
    await Promise.all(
      ids.slice(i, i + 100).map(async id => {
        try {
          await bounded(() => redis.del(teamClaimsKey(id)));
        } catch (e) {
          ConduitGrpcSdk.Logger.warn(
            `Team claims cache invalidation failed: ${parseErrorPayload(e).message || String(e)}`,
          );
        }
      }),
    );
  }
}
