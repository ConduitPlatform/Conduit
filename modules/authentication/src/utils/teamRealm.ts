import {
  ConduitGrpcSdk,
  FindRelationRequest,
  FindRelationResponse,
  GrpcError,
} from '@conduitplatform/grpc-sdk';
import { ModuleError } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { errors } from '../errors.js';
import { RealmMembership, RealmSettings, Team, User } from '../models/index.js';
import {
  assertGuestAllowed,
  evaluateGuestAllowed,
  grantRealmMembership,
  MAX_TEAM_DEPTH,
  realmsEnabled,
  resolveTeamRealm,
  revokeRealmMembership,
} from './realm.js';
import {
  classifyRealmMember,
  decorateMembers,
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
): Promise<void> {
  if (!realmsEnabled()) return;
  const realmTeam = await resolveTeamRealm(teamId);
  if (!realmTeam) return;
  const realmId = String(realmTeam._id);
  const policies = await loadGuestPolicies(realmId);
  if (!policies) return;
  for (const user of users) {
    if (classifyRealmMember(user.homeRealm, realmId).type !== 'guest') continue;
    const existing = await RealmMembership.getInstance().findOne({
      user: String(user._id),
      realm: realmId,
    });
    if (existing) continue;
    assertGuestAllowed(policies, user.homeRealm ? String(user.homeRealm) : null);
  }
}

/**
 * Adds a user to a team with `role`. For a team inside a realm the realm membership is
 * written first (home when the user has no home realm yet, which then becomes this
 * realm, or when it already is their home; guest otherwise, with the guest policy
 * enforced), so a refused guest leaves no relation behind. Idempotent.
 */
export async function addUserToTeamWithRealm(
  grpcSdk: ConduitGrpcSdk,
  params: { teamId: string; userId: string; role: string },
): Promise<void> {
  const { teamId, userId, role } = params;
  const realmTeam = realmsEnabled() ? await resolveTeamRealm(teamId) : null;
  if (realmTeam) {
    const realmId = String(realmTeam._id);
    const existing = await RealmMembership.getInstance().findOne({
      user: userId,
      realm: realmId,
    });
    if (!existing) {
      // always judge on the stored home realm, the caller's user object may be stale
      const user = await User.getInstance().findOne({ _id: userId });
      if (!user) throw new GrpcError(status.NOT_FOUND, 'User does not exist');
      const { type, setHomeRealm } = classifyRealmMember(user.homeRealm, realmId);
      await grantRealmMembership(grpcSdk, {
        userId,
        realmTeamId: realmId,
        type,
        enforceGuestPolicy: true,
      });
      if (setHomeRealm) {
        await User.getInstance().findByIdAndUpdate(userId, { homeRealm: realmId });
      }
    }
  }
  await grpcSdk.authorization!.createRelation({
    subject: 'User:' + userId,
    relation: role,
    resource: 'Team:' + teamId,
  });
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
  const invitee = await User.getInstance().findOne({ email: email.toLowerCase() });
  if (!invitee) return;
  const { type } = classifyRealmMember(invitee.homeRealm, realmId);
  if (type !== 'guest') return;
  const policies = await loadGuestPolicies(realmId);
  if (!policies) return;
  const result = evaluateGuestAllowed(policies, String(invitee.homeRealm));
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
