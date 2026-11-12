import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ParsedRouterRequest,
  Query,
  TYPE,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { errors } from '../errors.js';
import { RealmMembership, Team, Token, User } from '../models/index.js';
import { isNil } from 'lodash-es';
import escapeStringRegexp from 'escape-string-regexp';
import { AuthUtils } from '../utils/index.js';
import { invalidateTeamClaims } from '../utils/teamClaims.js';
import {
  addUserToTeamWithRealm,
  assertTeamDeletable,
  assertTeamMembersRemovable,
  assertUsersCanJoinTeam,
  decorateMembershipType,
  deleteTeamAndDetachChildren,
  requireAuthorization,
  revokeOrphanedGuests,
} from '../utils/teamRealm.js';
import { realmsEnabled, resolveTeamRealm } from '../utils/realm.js';
import { TokenType } from '../constants/index.js';
import { groupUserTeamRelations } from './user.logic.js';
import { v4 as uuid } from 'uuid';
import {
  ConduitBoolean,
  ConduitJson,
  ConduitNumber,
  ConduitObjectId,
  ConduitString,
  ModuleError,
  RoutingManager,
} from '@conduitplatform/module-tools';

type UserTeamEntry = {
  _id: string;
  name: string;
  isDefault: boolean;
  roles: string[];
  parentTeam?: string;
  realm?: { enabled: boolean; slug?: string };
  membershipType?: string;
};

function teamMatchesSearch(team: Team, search: unknown): boolean {
  if (isNil(search) || search === '') return true;
  const text = String(search);
  if (/^[a-fA-F0-9]{24}$/.test(text)) return String(team._id) === text;
  return team.name.toLowerCase().includes(text.toLowerCase());
}

function userTeamEntry(
  team: Team,
  roles: string[],
  membershipType: string | undefined,
): UserTeamEntry {
  const entry: UserTeamEntry = {
    _id: String(team._id),
    name: team.name,
    isDefault: Boolean(team.isDefault),
    roles,
  };
  if (team.parentTeam) entry.parentTeam = String(team.parentTeam);
  if (team.realm) {
    entry.realm = {
      enabled: Boolean(team.realm.enabled),
      ...(team.realm.slug ? { slug: team.realm.slug } : {}),
    };
  }
  if (membershipType) entry.membershipType = membershipType;
  return entry;
}

// relations fetched per authorization call while listing a user's teams
const USER_TEAM_RELATION_PAGE = 500;
// upper bound on the team relations loaded for one user
const MAX_USER_TEAM_RELATIONS = 10_000;

/** Every team relation the user holds, read page by page. */
async function loadUserTeamRelations(
  grpcSdk: ConduitGrpcSdk,
  userId: string,
): Promise<{ resource?: string; relation?: string }[]> {
  const relations: { resource?: string; relation?: string }[] = [];
  while (relations.length < MAX_USER_TEAM_RELATIONS) {
    const page = await grpcSdk.authorization!.findRelation({
      subject: 'User:' + userId,
      resourceType: 'Team',
      skip: relations.length,
      limit: USER_TEAM_RELATION_PAGE,
    });
    const rows = page?.relations ?? [];
    relations.push(...rows);
    if (rows.length < USER_TEAM_RELATION_PAGE || relations.length >= (page?.count ?? 0)) {
      return relations;
    }
  }
  ConduitGrpcSdk.Logger.warn(
    `User ${userId} holds more than ${MAX_USER_TEAM_RELATIONS} team relations; the list is truncated`,
  );
  return relations;
}

/**
 * The user's teams that exist and match `search`, ordered by name then id so pages are
 * stable (relations come back in no guaranteed order).
 */
async function teamsForUser(
  grouped: { teamId: string; roles: string[] }[],
  search: unknown,
): Promise<{ team: Team; roles: string[] }[]> {
  const found = await Team.getInstance().findMany({
    _id: { $in: grouped.map(group => group.teamId) },
  });
  const byId = new Map(found.map(team => [String(team._id), team]));
  return grouped
    .flatMap(group => {
      const team = byId.get(group.teamId);
      return team && teamMatchesSearch(team, search)
        ? [{ team, roles: group.roles }]
        : [];
    })
    .sort(
      (a, b) =>
        a.team.name.localeCompare(b.team.name) ||
        String(a.team._id).localeCompare(String(b.team._id)),
    );
}

/** The user's membership type in the realm of each team (one membership query). */
async function membershipTypesFor(
  userId: string,
  teams: Team[],
): Promise<Map<string, string>> {
  const types = new Map<string, string>();
  if (!realmsEnabled() || teams.length === 0) return types;
  const realms = await Promise.all(teams.map(team => resolveTeamRealm(String(team._id))));
  const realmByTeam = new Map<string, string>();
  teams.forEach((team, index) => {
    const realm = realms[index];
    if (realm) realmByTeam.set(String(team._id), String(realm._id));
  });
  if (realmByTeam.size === 0) return types;
  const memberships = await RealmMembership.getInstance().findMany({
    user: userId,
    realm: { $in: [...new Set(realmByTeam.values())] },
  });
  const byRealm = new Map(
    memberships.map(membership => [String(membership.realm), membership.membershipType]),
  );
  for (const [teamId, realmId] of realmByTeam) {
    const type = byRealm.get(realmId);
    if (type) types.set(teamId, type);
  }
  return types;
}

export class TeamsAdmin {
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  declareRoutes(routingManager: RoutingManager) {
    routingManager.route(
      {
        path: '/users/:id/teams',
        action: ConduitRouteActions.GET,
        urlParams: {
          id: { type: TYPE.String, required: true },
        },
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          search: ConduitString.Optional,
        },
        name: 'GetUserTeams',
        description:
          'Returns the teams a user belongs to, with every role the user holds on each team. skip, limit, search and count apply to teams. Realm teams include the user membership type.',
      },
      new ConduitRouteReturnDefinition('GetUserTeams', {
        teams: [
          {
            _id: ConduitString.Required,
            name: ConduitString.Required,
            parentTeam: ConduitString.Optional,
            isDefault: ConduitBoolean.Required,
            realm: {
              type: {
                enabled: ConduitBoolean.Optional,
                slug: ConduitString.Optional,
              },
              required: false,
            },
            roles: [ConduitString.Required],
            membershipType: ConduitString.Optional,
          },
        ],
        count: ConduitNumber.Required,
      }),
      this.getUserTeams.bind(this),
    );
    routingManager.route(
      {
        path: '/teams',
        action: ConduitRouteActions.GET,
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          sort: ConduitString.Optional,
          search: ConduitString.Optional,
          parentTeam: ConduitObjectId.Optional,
          realm: ConduitBoolean.Optional,
          populate: [ConduitString.Optional],
        },
        name: 'GetTeams',
        description: 'Gets all available teams',
      },
      new ConduitRouteReturnDefinition('GetTeams', {
        teams: [Team.name],
        count: ConduitNumber.Required,
      }),
      this.getTeams.bind(this),
    );
    routingManager.route(
      {
        path: '/teams',
        action: ConduitRouteActions.POST,
        bodyParams: {
          name: ConduitString.Required,
          parentTeam: ConduitObjectId.Optional,
          isDefault: ConduitBoolean.Optional,
        },
        name: 'CreateTeam',
        description: 'Creates a new team',
        errors: [
          errors.DEFAULT_TEAM_EXISTS,
          errors.TEAM_EXISTS,
          errors.AUTHORIZATION_UNAVAILABLE,
        ],
      },
      new ConduitRouteReturnDefinition('Team', Team.name),
      this.createTeam.bind(this),
    );
    routingManager.route(
      {
        path: '/teams/:teamId',
        action: ConduitRouteActions.GET,
        urlParams: {
          teamId: ConduitObjectId.Required,
        },
        queryParams: {
          populate: [ConduitString.Optional],
        },
        name: 'GetTeam',
        description: 'Gets the specified team',
      },
      new ConduitRouteReturnDefinition('Team'),
      this.getTeam.bind(this),
    );
    routingManager.route(
      {
        path: '/teams/:teamId/members',
        action: ConduitRouteActions.GET,
        urlParams: {
          teamId: ConduitObjectId.Required,
        },
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          sort: ConduitString.Optional,
          search: ConduitString.Optional,
        },
        name: 'GetTeamMembers',
        description: 'Gets members of a team',
        errors: [errors.AUTHORIZATION_UNAVAILABLE],
      },
      new ConduitRouteReturnDefinition('GetTeamMembers', {
        members: [User.name],
        count: ConduitNumber.Required,
      }),
      this.getTeamMembers.bind(this),
    );
    routingManager.route(
      {
        path: '/teams/:teamId/members',
        action: ConduitRouteActions.POST,
        urlParams: {
          teamId: ConduitObjectId.Required,
        },
        bodyParams: {
          members: {
            type: [TYPE.ObjectId],
            required: true,
          },
        },
        errors: [
          errors.TEAM_NOT_FOUND,
          errors.USER_IDS_INVALID,
          errors.USER_NOT_FOUND,
          errors.GUESTS_NOT_ALLOWED,
          errors.LINK_CONFLICT,
          errors.AUTHORIZATION_UNAVAILABLE,
        ],
        name: 'AddTeamMembers',
        description: 'Add members to a team',
      },
      new ConduitRouteReturnDefinition('AddTeamMembers', 'String'),
      this.addTeamMembers.bind(this),
    );
    routingManager.route(
      {
        path: '/teams/:teamId/members',
        action: ConduitRouteActions.DELETE,
        urlParams: {
          teamId: ConduitObjectId.Required,
        },
        queryParams: {
          members: {
            type: [TYPE.ObjectId],
            required: true,
          },
        },
        errors: [
          errors.USER_IDS_REQUIRED,
          errors.USER_IDS_INVALID,
          errors.TEAM_NOT_FOUND,
          errors.USER_NOT_FOUND,
          errors.HOME_USER_REMOVAL,
          errors.AUTHORIZATION_UNAVAILABLE,
        ],
        name: 'RemoveTeamMembers',
        description: 'Remove members from a team',
      },
      new ConduitRouteReturnDefinition('RemoveTeamMembers', 'String'),
      this.removeTeamMembers.bind(this),
    );
    routingManager.route(
      {
        path: '/teams/:teamId/members',
        action: ConduitRouteActions.PATCH,
        urlParams: {
          teamId: ConduitObjectId.Required,
        },
        bodyParams: {
          members: {
            type: [TYPE.ObjectId],
            required: true,
          },
          role: { type: TYPE.String, required: true },
        },
        name: 'ModifyMembersRoles',
        description: 'Modifies the roles of members in a team',
        errors: [
          errors.TEAM_NOT_FOUND,
          errors.USER_IDS_REQUIRED,
          errors.USER_IDS_INVALID,
          errors.AUTHORIZATION_UNAVAILABLE,
        ],
      },
      new ConduitRouteReturnDefinition('ModifyMembersRoles', 'String'),
      this.modifyMembersRoles.bind(this),
    );
    routingManager.route(
      {
        path: '/teams/:teamId',
        action: ConduitRouteActions.PATCH,
        urlParams: {
          teamId: ConduitObjectId.Required,
        },
        bodyParams: {
          name: ConduitString.Optional,
          isDefault: ConduitBoolean.Optional,
        },
        name: 'UpdateTeam',
        description: 'Updates a team',
        errors: [
          errors.TEAM_NOT_FOUND,
          errors.DEFAULT_TEAM_REALM_CONFLICT,
          errors.DEFAULT_TEAM_EXISTS,
          errors.TEAM_EXISTS,
        ],
      },
      new ConduitRouteReturnDefinition('Team', Team.name),
      this.updateTeam.bind(this),
    );
    routingManager.route(
      {
        path: '/teams/:teamId',
        action: ConduitRouteActions.DELETE,
        urlParams: {
          teamId: ConduitObjectId.Required,
        },
        name: 'DeleteTeam',
        description: 'Deletes a team',
        errors: [
          errors.TEAM_NOT_FOUND,
          errors.DEFAULT_TEAM_NOT_DELETABLE,
          errors.REALM_TEAM_NOT_DELETABLE,
          errors.AUTHORIZATION_UNAVAILABLE,
        ],
      },
      new ConduitRouteReturnDefinition('DeleteTeam', 'String'),
      this.deleteTeam.bind(this),
    );
    routingManager.route(
      {
        path: '/teams/:teamId/invites',
        action: ConduitRouteActions.GET,
        urlParams: {
          teamId: ConduitObjectId.Required,
        },
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
        },
        name: 'GetTeamInvites',
        description: 'Gets invite tokens for a team',
        errors: [errors.TEAM_NOT_FOUND],
      },
      new ConduitRouteReturnDefinition('GetTeamInvites', {
        invites: [Token.name],
        count: ConduitNumber.Required,
      }),
      this.getTeamInvites.bind(this),
    );
    routingManager.route(
      {
        path: '/teams/:teamId/invite/persistent',
        action: ConduitRouteActions.POST,
        urlParams: {
          teamId: ConduitObjectId.Required,
        },
        bodyParams: {
          role: ConduitString.Required,
          userData: ConduitJson.Optional,
        },
        name: 'CreatePersistentInvite',
        description: 'Creates a persistent invitation token for a team',
        errors: [errors.TEAM_NOT_FOUND],
      },
      new ConduitRouteReturnDefinition('PersistentInvitationToken', 'String'),
      this.createPersistentInvite.bind(this),
    );
    routingManager.route(
      {
        path: '/teams/:teamId/invite/persistent',
        action: ConduitRouteActions.DELETE,
        urlParams: {
          teamId: ConduitObjectId.Required,
        },
        queryParams: {
          invitationToken: ConduitString.Required,
        },
        name: 'DeletePersistentInvite',
        description: 'Deletes a persistent invitation token',
        errors: [errors.TEAM_NOT_FOUND, errors.TEAM_INVITE_NOT_FOUND],
      },
      new ConduitRouteReturnDefinition('DeletePersistentInvitationToken', 'String'),
      this.deletePersistentInvite.bind(this),
    );
  }

  async getTeams(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { search, sort, parentTeam, populate, realm } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;

    let query: any = {};
    if (!isNil(search)) {
      if (search.match(/^[a-fA-F0-9]{24}$/)) {
        query = { _id: search };
      } else {
        const searchString = escapeStringRegexp(search);
        query['name'] = { $regex: `.*${searchString}.*`, $options: 'i' };
      }
    }
    if (!isNil(parentTeam)) {
      query['parentTeam'] = parentTeam;
    } else {
      query['$or'] = [{ parentTeam: null }, { parentTeam: { $exists: false } }];
    }
    if (!isNil(realm)) {
      // strict: only a real `true` selects realm teams
      query['realm.enabled'] = realm === true ? true : { $ne: true };
    }

    const teams: Team[] = await Team.getInstance().findMany(query, {
      skip,
      limit,
      sort,
      populate,
    });
    const count: number = await Team.getInstance().countDocuments(query);

    return { teams, count };
  }

  async getTeam(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { teamId, populate } = call.request.params;
    const team: Team | null = await Team.getInstance().findOne(
      { _id: teamId },
      { populate },
    );
    return team || 'Team not found';
  }

  async createTeam(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { name, isDefault, parentTeam } = call.request.params;
    if (isDefault) {
      const found = await Team.getInstance().findOne({ isDefault: true });
      if (found) {
        throw new ModuleError(errors.DEFAULT_TEAM_EXISTS);
      }
    }
    const found = await Team.getInstance().findOne({ name, parentTeam });
    if (found) {
      throw new ModuleError(errors.TEAM_EXISTS);
    }

    const team = await Team.getInstance().create({
      name,
      parentTeam: parentTeam || null,
      isDefault: isNil(isDefault) ? false : isDefault,
    });
    if (parentTeam) {
      await requireAuthorization(this.grpcSdk).createRelation({
        subject: 'Team:' + parentTeam,
        resource: 'Team:' + team._id,
        relation: 'owner',
      });
    }
    return team;
  }

  async modifyMembersRoles(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { members, teamId, role } = call.request.params;
    const team = await Team.getInstance().findOne({ _id: teamId });
    if (!team) {
      throw new ModuleError(errors.TEAM_NOT_FOUND);
    }
    await AuthUtils.validateMembers(members);
    try {
      for (const member of members) {
        const relation = await requireAuthorization(this.grpcSdk).findRelation({
          subject: 'User:' + member,
          resource: 'Team:' + team._id,
        });
        if (!relation || relation.relations.length === 0) {
          continue;
        }
        await requireAuthorization(this.grpcSdk).deleteAllRelations({
          subject: 'User:' + member,
          resource: 'Team:' + team._id,
        });
        await requireAuthorization(this.grpcSdk).createRelation({
          subject: 'User:' + member,
          resource: 'Team:' + team._id,
          relation: role,
        });
      }
    } finally {
      // roles are token claims: drop the cached ones (also after a partial failure)
      await invalidateTeamClaims(members.map(String));
    }
    return 'Ok';
  }

  async updateTeam(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { teamId, name, isDefault } = call.request.params;
    const found = await Team.getInstance().findOne({ _id: teamId });
    if (!found) {
      throw new ModuleError(errors.TEAM_NOT_FOUND);
    }
    if (isDefault === true && found.realm?.enabled === true) {
      throw new ModuleError(errors.DEFAULT_TEAM_REALM_CONFLICT);
    }
    if (isDefault) {
      const defaultTeam = await Team.getInstance().findOne({ isDefault: true });
      if (defaultTeam && defaultTeam._id !== teamId) {
        throw new ModuleError(errors.DEFAULT_TEAM_EXISTS);
      }
    }
    if (found.name !== name) {
      const duplicateName = await Team.getInstance().findOne({
        name,
        parentTeam: found.parentTeam,
      });
      if (duplicateName) {
        throw new ModuleError(errors.TEAM_EXISTS);
      }
    }
    const updatedTeam = await this.grpcSdk.database!.withOptionalTransaction(async db => {
      if (!found.isDefault && isDefault) {
        await Team.getInstance().updateOne(
          { isDefault: true },
          { isDefault: false },
          { transaction: db },
        );
      }

      return Team.getInstance().findByIdAndUpdate(
        teamId,
        {
          name,
          isDefault: isNil(isDefault) ? false : isDefault,
        },
        { transaction: db },
      );
    });

    return updatedTeam!;
  }

  async deleteTeam(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { teamId } = call.request.params;
    const team = await Team.getInstance().findOne({ _id: teamId });
    if (!team) {
      throw new ModuleError(errors.TEAM_NOT_FOUND);
    }
    if (team.isDefault) {
      throw new ModuleError(errors.DEFAULT_TEAM_NOT_DELETABLE);
    }
    assertTeamDeletable(team);
    await deleteTeamAndDetachChildren(this.grpcSdk, team);
    return 'Team deleted';
  }

  async addTeamMembers(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { members, teamId } = call.request.params;
    const team = await Team.getInstance().findOne({ _id: teamId });
    if (!team) {
      throw new ModuleError(errors.TEAM_NOT_FOUND);
    }
    const existingUsers = await User.getInstance().findMany({
      _id: { $in: members },
    });
    if (existingUsers.length !== members.length) {
      throw new ModuleError(errors.USER_IDS_INVALID);
    }
    const users = await User.getInstance().findMany({ _id: { $in: members } });
    if (!users || users.length === 0) {
      throw new ModuleError(errors.USER_NOT_FOUND);
    }
    // a team inside a realm: refuse unwanted guests before anything is written
    await assertUsersCanJoinTeam(String(team._id), users, 'admin');
    for (const user of users) {
      await addUserToTeamWithRealm(this.grpcSdk, {
        teamId: String(team._id),
        userId: String(user._id),
        role: 'member',
        mode: 'admin',
      });
    }
    return 'Users added to team';
  }

  async removeTeamMembers(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { members, teamId } = call.request.params;
    await AuthUtils.validateMembers(members);
    const team = await Team.getInstance().findOne({ _id: teamId });
    if (!team) {
      throw new ModuleError(errors.TEAM_NOT_FOUND);
    }
    const users = await User.getInstance().findMany({ _id: { $in: members } });
    if (!users || users.length === 0) {
      throw new ModuleError(errors.USER_NOT_FOUND);
    }
    await assertTeamMembersRemovable(
      team,
      users.map(user => String(user._id)),
    );
    try {
      for (const user of users) {
        await requireAuthorization(this.grpcSdk).deleteAllRelations({
          subject: 'User:' + user._id,
          resource: 'Team:' + teamId,
        });
      }
    } finally {
      await invalidateTeamClaims(users.map(user => String(user._id)));
    }
    await revokeOrphanedGuests(
      this.grpcSdk,
      teamId,
      users.map(user => String(user._id)),
    );

    return 'Users removed from team';
  }

  async getUserTeams(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, search } = call.request.params;
    const skip = Math.max(0, Number(call.request.params.skip ?? 0) || 0);
    const limit = Math.max(0, Number(call.request.params.limit ?? 25) || 0);
    const user = await User.getInstance().findOne({ _id: id });
    if (isNil(user)) {
      throw new ModuleError(errors.USER_NOT_FOUND);
    }
    const userId = String(user._id);
    // skip, limit, search and count apply to teams, so every relation is read first:
    // a team's roles may be several relations
    const grouped = groupUserTeamRelations(
      await loadUserTeamRelations(this.grpcSdk, userId),
    );
    if (grouped.length === 0) {
      return { teams: [], count: 0 };
    }
    const matching = await teamsForUser(grouped, search);
    const page = matching.slice(skip, skip + limit);
    const types = await membershipTypesFor(
      userId,
      page.map(entry => entry.team),
    );
    const teams = page.map(entry =>
      userTeamEntry(entry.team, entry.roles, types.get(String(entry.team._id))),
    );
    return { teams, count: matching.length };
  }

  async getTeamMembers(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { teamId, search, sort } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;

    const relations = await requireAuthorization(this.grpcSdk).findRelation({
      resource: 'Team:' + teamId,
      subjectType: 'User',
    });

    if (!relations || relations.relations.length === 0) {
      return { members: [], count: 0 };
    }

    const { members, count } = await AuthUtils.fetchMembers({
      relations,
      search,
      skip,
      limit,
      sort,
    });
    await decorateMembershipType(members, teamId);
    return { members: members, count };
  }

  async getTeamInvites(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { teamId } = call.request.params;
    const skip = call.request.params.skip ?? 0;
    const limit = call.request.params.limit ?? 25;
    const team = await Team.getInstance().findOne({ _id: teamId });
    if (!team) {
      throw new ModuleError(errors.TEAM_NOT_FOUND);
    }
    const query = {
      tokenType: TokenType.TEAM_INVITE_TOKEN,
      'data.teamId': teamId,
    };
    const invites = await Token.getInstance().findMany(query, {
      skip,
      limit,
      sort: '-createdAt',
    });
    const count = await Token.getInstance().countDocuments(query);
    return { invites, count };
  }

  async createPersistentInvite(
    call: ParsedRouterRequest,
  ): Promise<UnparsedRouterResponse> {
    const { teamId, role, userData } = call.request.params;
    const team = await Team.getInstance().findOne({ _id: teamId });
    if (!team) {
      throw new ModuleError(errors.TEAM_NOT_FOUND);
    }
    const invitation = await Token.getInstance().create({
      tokenType: TokenType.TEAM_INVITE_TOKEN,
      token: uuid(),
      data: {
        teamId,
        role: role || 'member',
        userData,
      },
    });
    return invitation.token;
  }

  async deletePersistentInvite(
    call: ParsedRouterRequest,
  ): Promise<UnparsedRouterResponse> {
    const { teamId, invitationToken } = call.request.params;
    const team = await Team.getInstance().findOne({ _id: teamId });
    if (!team) {
      throw new ModuleError(errors.TEAM_NOT_FOUND);
    }
    const foundToken = await Token.getInstance().findOne(
      {
        token: invitationToken,
        'data.teamId': teamId,
      } as Query<Token>,
      { readPreference: 'primary' },
    );
    if (!foundToken) {
      throw new ModuleError(errors.TEAM_INVITE_NOT_FOUND);
    }
    await Token.getInstance().deleteOne({ _id: foundToken._id });
    return 'Invitation token deleted';
  }
}
