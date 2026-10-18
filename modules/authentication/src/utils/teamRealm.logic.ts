import { RealmMembershipType } from './realm.logic.js';

/*
 * Pure rules for team membership inside realms (no database or grpc access). IO lives
 * in ./teamRealm.ts.
 */

/**
 * Who adds the user: an administrator (admin API, promote) or the client API (team owner
 * add without invite, invite accept, persistent invite accept).
 */
export type RealmMemberMode = 'admin' | 'client';

/**
 * How a user joins a team that sits inside a realm:
 *  - the realm is their home: home membership, nothing to set (both modes);
 *  - another home realm: guest membership (both modes);
 *  - no home realm yet: `admin` makes the realm their home (`setHomeRealm`), `client`
 *    never re-homes anybody, so they become a guest (the realm guest policy applies).
 *    Brand-new registrations through an invite get their home realm from the
 *    registration itself, not from this function.
 */
export function classifyRealmMember(
  userHomeRealm: unknown,
  realmTeamId: string,
  mode: RealmMemberMode,
): { type: RealmMembershipType; setHomeRealm: boolean } {
  const home = userHomeRealm ? String(userHomeRealm) : null;
  if (home === String(realmTeamId)) return { type: 'home', setHomeRealm: false };
  if (!home && mode === 'admin') return { type: 'home', setHomeRealm: true };
  return { type: 'guest', setHomeRealm: false };
}

/**
 * Number of documents an update changed, across the adapters: Mongo returns
 * `{ matchedCount, modifiedCount }`, SQL returns the updated documents. Unknown shapes
 * count as 0, so callers must re-read when 0 is ambiguous.
 */
export function countUpdated(result: unknown): number {
  if (Array.isArray(result)) return result.length;
  if (typeof result !== 'object' || result === null) return 0;
  const record = result as Record<string, unknown>;
  for (const key of ['modifiedCount', 'nModified', 'matchedCount', 'n']) {
    if (typeof record[key] === 'number') return record[key] as number;
  }
  return 0;
}

/** Query for tokens that are not bound to a realm (global sessions). */
export function realmlessTokenQuery(userIds: string[]): Record<string, unknown> {
  return {
    user: userIds.length === 1 ? userIds[0] : { $in: userIds },
    $or: [{ realm: null }, { realm: { $exists: false } }],
  };
}

/**
 * Ids in `requested` that are not in `existing` (realm team ids), without duplicates.
 * Used to validate `policies.guests.allowedHomeRealms` on write.
 */
export function findUnknownRealmIds(
  requested: Iterable<unknown>,
  existing: Iterable<unknown>,
): string[] {
  const known = new Set(Array.from(existing, String));
  return Array.from(new Set(Array.from(requested, String))).filter(id => !known.has(id));
}

/** Resource ids (`Team:<id>`) of authorization relations as team ids. */
export function relationTeamIds(
  relations: { resource: string }[] | null | undefined,
): string[] {
  return (relations ?? [])
    .map(relation => relation.resource)
    .filter(resource => typeof resource === 'string' && resource.startsWith('Team:'))
    .map(resource => resource.slice('Team:'.length));
}

/** Whether any of the relations targets one of the given teams. */
export function relationsTouchTeams(
  relations: { resource: string }[] | null | undefined,
  teamIds: Iterable<string>,
): boolean {
  const wanted = new Set(Array.from(teamIds, String));
  return relationTeamIds(relations).some(id => wanted.has(id));
}

/** User ids of `User:<id>` relation subjects, without duplicates. */
export function relationUserIds(
  relations: { subject: string }[] | null | undefined,
): string[] {
  const ids = (relations ?? [])
    .map(relation => relation.subject)
    .filter(subject => typeof subject === 'string' && subject.startsWith('User:'))
    .map(subject => subject.slice('User:'.length));
  return Array.from(new Set(ids));
}

/**
 * Adds `membershipType` (when known) to each member. Mutates and returns the list, same
 * as `AuthUtils.fetchMembers` does for `role`.
 */
export function decorateMembers<T extends { _id: unknown }>(
  members: T[],
  memberships: { user: unknown; membershipType: RealmMembershipType }[],
): (T & { membershipType?: RealmMembershipType })[] {
  const byUser = new Map<string, RealmMembershipType>(
    memberships.map(membership => [String(membership.user), membership.membershipType]),
  );
  for (const member of members as (T & { membershipType?: RealmMembershipType })[]) {
    const type = byUser.get(String(member._id));
    if (type) member.membershipType = type;
  }
  return members as (T & { membershipType?: RealmMembershipType })[];
}
