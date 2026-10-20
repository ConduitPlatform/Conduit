import {
  ConduitGrpcSdk,
  FindRelationRequest,
  FindRelationResponse,
  GrpcError,
  Indexable,
} from '@conduitplatform/grpc-sdk';
import { ModuleError } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { errors } from '../errors.js';
import {
  AccessToken,
  RealmMembership,
  RealmSettings,
  RefreshToken,
  Team,
  User,
} from '../models/index.js';
import {
  assertGuestAllowed,
  evaluateGuestAllowed,
  grantRealmMembership,
  MAX_TEAM_DEPTH,
  identityMode,
  realmsEnabled,
  resolveTeamRealm,
  revokeRealmMembership,
  withHomeScope,
} from './realm.js';
import {
  classifyRealmMember,
  countUpdated,
  decorateMembers,
  findUnknownRealmIds,
  RealmMemberMode,
  realmlessTokenQuery,
  relationsTouchTeams,
  relationUserIds,
} from './teamRealm.logic.js';

export * from './teamRealm.logic.js';

type Relations = FindRelationResponse['relations'];

const RELATION_PAGE_SIZE = 500;

/** Team ids of `rootId` and everything below it (level by level, cycle safe). */
export async function collectTeamSubtreeIds(rootId: string): Promise<string[]> {
  const all = [String(rootId)];
  const seen = new Set(all);
  let level = [String(rootId)];
  for (let depth = 0; level.length > 0 && depth < MAX_TEAM_DEPTH; depth++) {
    const children = await Team.getInstance().findMany({ parentTeam: { $in: level } });
    level = children.map(child => String(child._id)).filter(id => !seen.has(id));
    level.forEach(id => {
      seen.add(id);
      all.push(id);
    });
  }
  return all;
}

/** Every relation matching the request, fetched page by page. */
export async function fetchAllRelations(
  grpcSdk: ConduitGrpcSdk,
  request: Omit<FindRelationRequest, 'skip' | 'limit'>,
): Promise<Relations> {
  const relations: Relations = [];
  for (let skip = 0; ; skip += RELATION_PAGE_SIZE) {
    const page = await grpcSdk.authorization!.findRelation({
      ...request,
      skip,
      limit: RELATION_PAGE_SIZE,
    });
    relations.push(...(page?.relations ?? []));
    if (!page || page.relations.length < RELATION_PAGE_SIZE) break;
  }
  return relations;
}

/** Ids of the users that hold a relation on any of the teams. */
export async function collectTeamUserIds(
  grpcSdk: ConduitGrpcSdk,
  teamIds: string[],
): Promise<string[]> {
  const ids = new Set<string>();
  for (const teamId of teamIds) {
    const relations = await fetchAllRelations(grpcSdk, {
      resource: 'Team:' + teamId,
      subjectType: 'User',
    });
    relationUserIds(relations).forEach(id => ids.add(id));
  }
  return Array.from(ids);
}

async function loadGuestPolicies(realmTeamId: string) {
  const settings = await RealmSettings.getInstance().findOne({ team: realmTeamId });
  return settings?.policies ?? null;
}

/**
 * Throws GUESTS_NOT_ALLOWED when adding any of the users to a team inside a realm would
 * make them a guest the realm refuses. Run it before writing anything. No-op for teams
 * outside a realm and with the feature off.
 */
export async function assertUsersCanJoinTeam(
  teamId: string,
  users: Pick<User, '_id' | 'homeRealm'>[],
  mode: RealmMemberMode,
): Promise<void> {
  if (!realmsEnabled()) return;
  const realmTeam = await resolveTeamRealm(teamId);
  if (!realmTeam) return;
  const realmId = String(realmTeam._id);
  const policies = await loadGuestPolicies(realmId);
  if (!policies) return;
  for (const user of users) {
    if (classifyRealmMember(user.homeRealm, realmId, mode).type !== 'guest') continue;
    const existing = await RealmMembership.getInstance().findOne({
      user: String(user._id),
      realm: realmId,
    });
    if (existing) continue;
    assertGuestAllowed(policies, user.homeRealm ? String(user.homeRealm) : null);
  }
}

/** Deletes the user's sessions that are not bound to a realm (global sessions). */
export async function revokeRealmlessTokens(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const query = realmlessTokenQuery(userIds);
  await Promise.all([
    AccessToken.getInstance().deleteMany(query),
    RefreshToken.getInstance().deleteMany(query),
  ]);
}

/**
 * Sets the home realm of a user who has none yet. The write is conditional on the user
 * still having no home realm, so concurrent adds into different realms cannot give a
 * user two homes:
 *  - `claimed`: this call set it;
 *  - `already`: the user is already home at this realm (a concurrent call won);
 *  - `lost`: the user is homed elsewhere now.
 */
export async function claimHomeRealm(
  userId: string,
  realmId: string,
): Promise<'claimed' | 'already' | 'lost'> {
  const result = await User.getInstance().updateMany(
    withHomeScope({ _id: userId }, null),
    { homeRealm: realmId },
  );
  if (countUpdated(result) > 0) return 'claimed';
  const fresh = await User.getInstance().findOne(
    { _id: userId },
    { readPreference: 'primary' },
  );
  if (!fresh) throw new GrpcError(status.NOT_FOUND, 'User does not exist');
  return fresh.homeRealm && String(fresh.homeRealm) === realmId ? 'already' : 'lost';
}

/** Runs rollback steps, last first. Best effort: never masks the original error. */
async function runRollback(steps: (() => Promise<unknown>)[]): Promise<void> {
  for (const step of steps.reverse()) {
    try {
      await step();
    } catch (e) {
      ConduitGrpcSdk.Logger.error(e as Error);
    }
  }
}

/**
 * Adds a user to a team with `role`. For a team inside a realm the realm membership is
 * written first, classified by `mode` (see classifyRealmMember: `admin` homes users
 * without a home realm, `client` never re-homes and makes them guests; the guest policy
 * is enforced), so a refused guest leaves no relation behind. When the relation write
 * fails, the membership and the home realm set by this call are rolled back.
 * Idempotent.
 */
export async function addUserToTeamWithRealm(
  grpcSdk: ConduitGrpcSdk,
  params: { teamId: string; userId: string; role: string; mode: RealmMemberMode },
): Promise<void> {
  const { teamId, userId, role, mode } = params;
  const realmTeam = realmsEnabled() ? await resolveTeamRealm(teamId) : null;
  const rollback: (() => Promise<unknown>)[] = [];
  try {
    if (realmTeam) {
      const realmId = String(realmTeam._id);
      const existing = await RealmMembership.getInstance().findOne({
        user: userId,
        realm: realmId,
      });
      if (!existing) await joinRealm(grpcSdk, { userId, realmId, mode }, rollback);
    }
    await grpcSdk.authorization!.createRelation({
      subject: 'User:' + userId,
      relation: role,
      resource: 'Team:' + teamId,
    });
  } catch (e) {
    await runRollback(rollback);
    throw e;
  }
}

/** Writes the membership (and the home realm for admins), registering the undo steps. */
async function joinRealm(
  grpcSdk: ConduitGrpcSdk,
  params: { userId: string; realmId: string; mode: RealmMemberMode },
  rollback: (() => Promise<unknown>)[],
): Promise<void> {
  const { userId, realmId, mode } = params;
  // always judge on the stored home realm, the caller's user object may be stale
  const user = await User.getInstance().findOne({ _id: userId });
  if (!user) throw new GrpcError(status.NOT_FOUND, 'User does not exist');
  const classification = classifyRealmMember(user.homeRealm, realmId, mode);
  let type = classification.type;
  let claimed = false;
  if (classification.setHomeRealm) {
    const claim = await claimHomeRealm(userId, realmId);
    if (claim === 'claimed') {
      claimed = true;
      rollback.push(() =>
        User.getInstance().updateMany(
          { _id: userId, homeRealm: realmId },
          { homeRealm: null },
        ),
      );
    } else if (claim === 'lost') {
      // another realm became their home in the meantime: they are a guest here
      type = 'guest';
    }
  }
  await grantRealmMembership(grpcSdk, {
    userId,
    realmTeamId: realmId,
    type,
    enforceGuestPolicy: true,
  });
  // registered only now: a failed grant created nothing that could be deleted here
  rollback.push(() =>
    RealmMembership.getInstance().deleteMany({ user: userId, realm: realmId }),
  );
  // sessions without a realm must not outlive the move into a realm
  if (claimed) await revokeRealmlessTokens([userId]);
}

/**
 * Throws HOME_USER_REMOVAL when `team` is a realm and any of the users is one of its
 * home users. Run it before removing anything.
 */
export async function assertTeamMembersRemovable(
  team: Pick<Team, '_id' | 'realm'>,
  userIds: string[],
): Promise<void> {
  if (!realmsEnabled() || team.realm?.enabled !== true || userIds.length === 0) return;
  const realmId = String(team._id);
  const homeMemberships = await RealmMembership.getInstance().countDocuments({
    realm: realmId,
    user: { $in: userIds },
    membershipType: 'home',
  });
  const homeUsers =
    homeMemberships > 0
      ? homeMemberships
      : await User.getInstance().countDocuments({
          _id: { $in: userIds },
          homeRealm: realmId,
        });
  if (homeUsers > 0) throw new ModuleError(errors.HOME_USER_REMOVAL);
}

/**
 * After users lost their relation on `teamId`: a guest who holds no relation on any team
 * of the realm any more loses the guest membership (and the tokens bound to the realm).
 * Home memberships are never touched here.
 */
export async function revokeOrphanedGuests(
  grpcSdk: ConduitGrpcSdk,
  teamId: string,
  userIds: string[],
): Promise<void> {
  if (!realmsEnabled() || userIds.length === 0) return;
  const realmTeam = await resolveTeamRealm(teamId);
  if (!realmTeam) return;
  const realmId = String(realmTeam._id);
  const realmTeamIds = await collectTeamSubtreeIds(realmId);
  for (const userId of userIds) {
    const membership = await RealmMembership.getInstance().findOne({
      user: userId,
      realm: realmId,
    });
    if (!membership || membership.membershipType !== 'guest') continue;
    const relations = await fetchAllRelations(grpcSdk, {
      subject: 'User:' + userId,
      resourceType: 'Team',
    });
    if (relationsTouchTeams(relations, realmTeamIds)) continue;
    await revokeRealmMembership(grpcSdk, { userId, realmTeamId: realmId });
  }
}

/** Adds `membershipType` to the members of a team that sits inside a realm. */
export async function decorateMembershipType<T extends { _id: unknown }>(
  members: T[],
  teamId: string,
): Promise<T[]> {
  if (!realmsEnabled() || members.length === 0) return members;
  const realmTeam = await resolveTeamRealm(teamId);
  if (!realmTeam) return members;
  const memberships = await RealmMembership.getInstance().findMany({
    realm: String(realmTeam._id),
    user: { $in: members.map(member => String(member._id)) },
  });
  return decorateMembers(members, memberships);
}

/**
 * Invitations into a realm team for an existing user of another realm fail up front when
 * the realm refuses that user as a guest (GUESTS_NOT_ALLOWED).
 */
export async function assertInviteeAllowed(
  teamId: string,
  email: string | undefined | null,
): Promise<void> {
  if (!email || !realmsEnabled()) return;
  const realmTeam = await resolveTeamRealm(teamId);
  if (!realmTeam) return;
  const realmId = String(realmTeam._id);
  const emailQuery = { email: email.toLowerCase() };
  let invitee: User | null;
  if (identityMode() === 'isolated') {
    // several accounts may hold the address, one per home realm: which one is invited is
    // only known at accept, which enforces the policy
    const holders = await User.getInstance().findMany(emailQuery, { limit: 2 });
    if (holders.length > 1) return;
    invitee = holders[0] ?? null;
  } else {
    invitee = await User.getInstance().findOne(emailQuery);
  }
  if (!invitee) return;
  // invites are a client path: an existing user is never re-homed, so never a home user
  const { type } = classifyRealmMember(invitee.homeRealm, realmId, 'client');
  if (type !== 'guest') return;
  const policies = await loadGuestPolicies(realmId);
  if (!policies) return;
  const result = evaluateGuestAllowed(
    policies,
    invitee.homeRealm ? String(invitee.homeRealm) : null,
  );
  if (!result.allowed) throw new ModuleError(errors[result.error]);
}

/** Realm teams cannot be deleted: demote them first. */
export function assertTeamDeletable(team: Pick<Team, 'realm'>): void {
  if (team.realm?.enabled === true) {
    throw new GrpcError(
      status.FAILED_PRECONDITION,
      'This team is a realm. Demote the realm before deleting the team.',
    );
  }
}

/**
 * Deletes a team: its relations, then its child teams move to the team's own parent
 * (top level when it has none) and, inside a realm, guests whose last relation in the
 * realm was on this team lose their guest membership. Realm teams must be refused by the
 * caller first (assertTeamDeletable).
 */
export async function deleteTeamAndDetachChildren(
  grpcSdk: ConduitGrpcSdk,
  team: Pick<Team, '_id' | 'parentTeam'>,
): Promise<void> {
  const teamId = String(team._id);
  const parentId = team.parentTeam ? String(team.parentTeam) : null;
  // collected up front: the relations are gone once the team is deleted
  const memberIds =
    parentId && realmsEnabled() ? await collectTeamUserIds(grpcSdk, [teamId]) : [];
  const children = await Team.getInstance().findMany({ parentTeam: teamId });

  await Team.getInstance().deleteOne({ _id: teamId });
  await grpcSdk.authorization!.deleteAllRelations({ resource: 'Team:' + teamId });
  await grpcSdk.authorization!.deleteAllRelations({ subject: 'Team:' + teamId });
  if (children.length > 0) {
    // null (not undefined, which an update drops) puts them on the top level
    await Team.getInstance().updateMany({ parentTeam: teamId }, {
      parentTeam: parentId,
    } as Indexable);
    if (parentId) {
      // the owner relation of the deleted parent went with it
      for (const child of children) {
        await grpcSdk.authorization!.createRelation({
          subject: 'Team:' + parentId,
          relation: 'owner',
          resource: 'Team:' + String(child._id),
        });
      }
    }
  }
  // the parent is still inside the same realm (a top-level team has no realm guests)
  if (parentId) await revokeOrphanedGuests(grpcSdk, parentId, memberIds);
}

/**
 * Throws INVALID_ARGUMENT listing the ids in `requested` that are not realm teams.
 * `selfId` (the realm being written) is accepted even when it is not a realm yet.
 */
export async function assertRealmTeamIds(
  requested: string[],
  selfId?: string,
): Promise<void> {
  const ids = requested.filter(id => id !== selfId);
  if (ids.length === 0) return;
  const query: Indexable = { _id: { $in: ids }, 'realm.enabled': true };
  const teams = await Team.getInstance().findMany(query);
  const unknown = findUnknownRealmIds(
    ids,
    teams.map(team => team._id),
  );
  if (unknown.length > 0) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      'policies.guests.allowedHomeRealms contains ids that are not realm teams: ' +
        unknown.join(', '),
    );
  }
}
