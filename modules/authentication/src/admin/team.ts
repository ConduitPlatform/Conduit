import ConduitGrpcSdk, {
  ConduitBoolean,
  ConduitNumber,
  ConduitObjectId,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  GrpcError,
  ParsedRouterRequest,
  RoutingManager,
  TYPE,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { Team, User } from '../models';
import { isNil } from 'lodash';
import escapeStringRegexp from 'escape-string-regexp';
import { AuthUtils } from '../utils';

export class TeamsAdmin {
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  declareRoutes(routingManager: RoutingManager) {
    routingManager.route(
      {
        path: '/teams',
        action: ConduitRouteActions.GET,
        urlParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          sort: ConduitString.Optional,
          search: ConduitString.Optional,
          parentTeam: ConduitObjectId.Optional,
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
      },
      new ConduitRouteReturnDefinition('Team', Team.name),
      this.createTeam.bind(this),
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
      },
      new ConduitRouteReturnDefinition('DeleteTeam', 'String'),
      this.deleteTeam.bind(this),
    );
  }

  async getTeams(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { search, sort, parentTeam } = call.request.params;
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
      query['parentTeam'] = { $or: [{ $exists: false }, { $eq: null }] };
    }

    const teams: Team[] = await Team.getInstance().findMany(
      query,
      undefined,
      skip,
      limit,
      sort,
    );
    const count: number = await Team.getInstance().countDocuments(query);

    return { teams, count };
  }

  async createTeam(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { name, isDefault, parentTeam } = call.request.params;
    if (isDefault) {
      const found = await Team.getInstance().findOne({ isDefault: true });
      if (found) {
        throw new GrpcError(status.ALREADY_EXISTS, 'There already is a default team');
      }
    }
    const found = await Team.getInstance().findOne({ name });
    if (found) {
      throw new GrpcError(status.ALREADY_EXISTS, 'Team already exists');
    }

    const team = await Team.getInstance().create({
      name,
      parentTeam: parentTeam || null,
      isDefault: isNil(isDefault) ? false : isDefault,
    });
    if (parentTeam) {
      await this.grpcSdk.authorization!.createRelation({
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
      throw new GrpcError(status.NOT_FOUND, 'Team does not exist');
    }
    await AuthUtils.validateMembers(members);
    for (const member of members) {
      const relation = await this.grpcSdk.authorization!.findRelation({
        subject: 'User:' + member,
        resource: 'Team:' + team._id,
      });
      if (!relation || relation.relations.length === 0) {
        continue;
      }
      await this.grpcSdk.authorization!.deleteAllRelations({
        subject: 'User:' + member,
        resource: 'Team:' + team._id,
      });
      await this.grpcSdk.authorization!.createRelation({
        subject: 'User:' + member,
        resource: 'Team:' + team._id,
        relation: role,
      });
    }
    return 'Ok';
  }

  async updateTeam(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { teamId, name, isDefault } = call.request.params;
    if (isDefault) {
      const found = await Team.getInstance().findOne({ isDefault: true });
      if (found && found._id !== teamId) {
        throw new GrpcError(status.ALREADY_EXISTS, 'There already is a default team');
      }
    }

    const updatedTeam = await Team.getInstance().findByIdAndUpdate(teamId, {
      name,
      isDefault: isNil(isDefault) ? false : isDefault,
    });
    if (!updatedTeam) {
      throw new GrpcError(status.NOT_FOUND, 'Team does not exist');
    }
    return updatedTeam;
  }

  async deleteTeam(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { teamId } = call.request.params;
    const team = await Team.getInstance().findOne({ _id: teamId });
    if (!team) {
      throw new GrpcError(status.NOT_FOUND, 'Team does not exist');
    }
    if (team.isDefault) {
      throw new GrpcError(status.FAILED_PRECONDITION, 'Default team cannot be deleted');
    }
    await Team.getInstance().deleteOne({ _id: teamId });
    await this.grpcSdk.authorization!.deleteAllRelations({ resource: 'Team:' + teamId });
    await this.grpcSdk.authorization!.deleteAllRelations({ subject: 'Team:' + teamId });
    await Team.getInstance().updateMany(
      { parentTeam: teamId },
      { parentTeam: undefined },
    );
    return 'Team deleted';
  }

  async addTeamMembers(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { members, teamId } = call.request.params;
    const team = await Team.getInstance().findOne({ _id: teamId });
    if (!team) {
      throw new GrpcError(status.NOT_FOUND, 'Team does not exist');
    }
    const existingUsers = await User.getInstance().findMany({
      _id: { $in: members },
    });
    if (existingUsers.length !== members.length) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'members array contains invalid user ids',
      );
    }
    const users = await User.getInstance().findMany({ _id: { $in: members } });
    if (!users || users.length === 0) {
      throw new GrpcError(status.NOT_FOUND, 'User does not exist');
    }
    for (const user of users) {
      await this.grpcSdk.authorization!.createRelation({
        subject: 'User:' + user._id,
        resource: 'Team:' + team._id,
        relation: 'member',
      });
    }
    return 'Users added to team';
  }

  async removeTeamMembers(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { members, teamId } = call.request.params;
    await AuthUtils.validateMembers(members);
    const team = await Team.getInstance().findOne({ _id: teamId });
    if (!team) {
      throw new GrpcError(status.NOT_FOUND, 'Team does not exist');
    }
    const users = await User.getInstance().findMany({ _id: { $in: members } });
    if (!users || users.length === 0) {
      throw new GrpcError(status.NOT_FOUND, 'Users does not exist');
    }
    for (const user of users) {
      await this.grpcSdk.authorization!.deleteAllRelations({
        subject: 'User:' + user._id,
        resource: 'Team:' + teamId,
      });
    }

    return 'Users removed from team';
  }

  async getTeamMembers(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { teamId, search, sort } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;

    const relations = await this.grpcSdk.authorization!.findRelation({
      resource: 'Team:' + teamId,
      relation: 'member',
    });
    const { members, count } = await AuthUtils.fetchMembers({
      relations,
      search,
      skip,
      limit,
      sort,
    });
    return { members: members, count };
  }
}
