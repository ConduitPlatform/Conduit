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
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { Team } from '../models/Team.schema';
import { isNil } from 'lodash';
import escapeStringRegexp from 'escape-string-regexp';
import { User } from '../models';

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
        path: '/teams',
        action: ConduitRouteActions.GET,
        urlParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          sort: ConduitString.Optional,
          search: ConduitString.Optional,
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
        path: '/teams/members/:id',
        action: ConduitRouteActions.GET,
        urlParams: {
          id: ConduitObjectId.Required,
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
        path: '/teams/:id',
        action: ConduitRouteActions.PATCH,
        urlParams: {
          id: ConduitObjectId.Required,
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
        path: '/teams/:id',
        action: ConduitRouteActions.DELETE,
        urlParams: {
          id: ConduitObjectId.Required,
        },
        name: 'DeleteTeam',
        description: 'Deletes a team',
      },
      new ConduitRouteReturnDefinition('DeleteTeam', 'String'),
      this.deleteTeam.bind(this),
    );
  }

  async getTeams(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { search, sort } = call.request.params;
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
      let found = await Team.getInstance().findOne({ isDefault: true });
      if (found) {
        throw new GrpcError(status.ALREADY_EXISTS, 'There already is a default team');
      }
    }
    let found = await Team.getInstance().findOne({ name });
    if (found) {
      throw new GrpcError(status.ALREADY_EXISTS, 'Team already exists');
    }

    let team = await Team.getInstance().create({
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

  async updateTeam(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, name, isDefault } = call.request.params;
    if (isDefault) {
      let found = await Team.getInstance().findOne({ isDefault: true });
      if (found && found._id !== id) {
        throw new GrpcError(status.ALREADY_EXISTS, 'There already is a default team');
      }
    }

    let updatedTeam = await Team.getInstance().findByIdAndUpdate(id, {
      name,
      isDefault: isNil(isDefault) ? false : isDefault,
    });
    if (!updatedTeam) {
      throw new GrpcError(status.NOT_FOUND, 'Team not found');
    }
    return updatedTeam;
  }

  async deleteTeam(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id } = call.request.params;
    let team = await Team.getInstance().findOne({ _id: id });
    if (!team) {
      throw new GrpcError(status.NOT_FOUND, 'Team not found');
    }
    if (team.isDefault) {
      throw new GrpcError(status.FAILED_PRECONDITION, 'Default team cannot be deleted');
    }
    await Team.getInstance().deleteOne({ _id: id });
    return 'Team deleted';
  }

  async addTeamMember(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { userId, teamId, role } = call.request.params;
    let team = await Team.getInstance().findOne({ _id: teamId });
    if (!team) {
      throw new GrpcError(status.NOT_FOUND, 'Team not found');
    }
    let user = await User.getInstance().findOne({ _id: userId });
    if (!user) {
      throw new GrpcError(status.NOT_FOUND, 'User not found');
    }
    await this.grpcSdk.authorization!.createRelation({
      subject: 'User:' + userId,
      resource: 'Team:' + teamId,
      relation: role,
    });
    return 'User added to team';
  }

  async removeTeamMember(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { userId, teamId, role } = call.request.params;
    let team = await Team.getInstance().findOne({ _id: teamId });
    if (!team) {
      throw new GrpcError(status.NOT_FOUND, 'Team not found');
    }
    let user = await User.getInstance().findOne({ _id: userId });
    if (!user) {
      throw new GrpcError(status.NOT_FOUND, 'User not found');
    }
    await this.grpcSdk.authorization!.deleteRelation({
      subject: 'User:' + userId,
      resource: 'Team:' + teamId,
      relation: role,
    });
    return 'User removed from team';
  }

  async getTeamMembers(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id } = call.request.params;
    const { search, sort } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;

    const relations = await this.grpcSdk.authorization!.findRelation({
      resource: 'Team:' + id,
      relation: 'member',
    });
    let query: any = {
      _id: { $in: relations.relations.map(r => r.subject.split(':')[1]) },
    };
    if (!isNil(search)) {
      if (search.match(/^[a-fA-F0-9]{24}$/)) {
        query = { _id: search };
      } else {
        const searchString = escapeStringRegexp(search);
        query['name'] = { $regex: `.*${searchString}.*`, $options: 'i' };
      }
    }

    const count = relations.relations.length;
    const members = await User.getInstance().findMany(
      query,
      undefined,
      skip,
      limit,
      sort,
    );
    return { members: members, count };
  }
}
