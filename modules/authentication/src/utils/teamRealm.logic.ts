import { RealmMembershipType } from './realm.logic.js';

/*
 * Pure rules for team membership inside realms (no database or grpc access). IO lives
 * in ./teamRealm.ts.
 */

/**
 * How a user joins a team that sits inside a realm:
 *  - no home realm yet: the realm becomes their home (`setHomeRealm`);
 *  - the realm is their home: home membership, nothing to set;
 *  - another home realm: guest membership.
 */
export function classifyRealmMember(
  userHomeRealm: unknown,
  realmTeamId: string,
): { type: RealmMembershipType; setHomeRealm: boolean } {
  const home = userHomeRealm ? String(userHomeRealm) : null;
  if (!home) return { type: 'home', setHomeRealm: true };
  if (home === String(realmTeamId)) return { type: 'home', setHomeRealm: false };
  return { type: 'guest', setHomeRealm: false };
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
