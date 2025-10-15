import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
  Indexable,
  ParsedRouterRequest,
  Query,
  TYPE,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';

import {
  ConduitBoolean,
  ConduitJson,
  ConduitNumber,
  ConduitObjectId,
  ConduitString,
  ConfigController,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { Team, Token, User } from '../models/index.js';
import { Config } from '../config/index.js';
import { Team as TeamAuthz } from '../authz/index.js';
import { TeamInviteTemplate } from '../templates/index.js';
import { status } from '@grpc/grpc-js';
import { AuthUtils } from '../utils/index.js';
import { IAuthenticationStrategy } from '../interfaces/index.js';
import { TokenType } from '../constants/index.js';
import { v4 as uuid } from 'uuid';
import { isEmpty } from 'lodash-es';

export class TeamsHandler implements IAuthenticationStrategy {
  private static _instance?: TeamsHandler;
  private initialized = false;

  private constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  public get isActive() {
    return this.initialized;
  }

  public static getInstance(grpcSdk?: ConduitGrpcSdk) {
    if (TeamsHandler._instance) return TeamsHandler._instance;
    if (!grpcSdk) throw new Error('GrpcSdk not provided');
    TeamsHandler._instance = new TeamsHandler(grpcSdk);
    return TeamsHandler._instance;
  }

  async inviteValidation(invitationToken: string, email?: string) {
    if (!this.initialized) {
      ConduitGrpcSdk.Logger.error('TeamsHandler not initialized');
      return false;
    }
    const inviteToken = await Token.getInstance().findOne({
      tokenType: TokenType.TEAM_INVITE_TOKEN,
      token: invitationToken,
    });
    if (!inviteToken) {
      return false;
    }
    if (
      inviteToken.data.email &&
      (!email || email !== inviteToken.data.email) &&
      !ConfigController.getInstance().config.teams.allowEmailMismatchForInvites
    ) {
      return false;
    }
    const team = await Team.getInstance().findOne({ _id: inviteToken!.data.teamId });
    if (!team) {
      return false;
    }
    return true;
  }

  async verifyUserViaInvitation(invitationToken: string, email: string) {
    if (!this.initialized) {
      ConduitGrpcSdk.Logger.error('TeamsHandler not initialized');
      return false;
    }
    const inviteToken = await Token.getInstance().findOne({
      tokenType: TokenType.TEAM_INVITE_TOKEN,
      token: invitationToken,
    });
    if (!inviteToken) {
      return false;
    }
    if (!inviteToken.data.email) {
      return false;
    }
    if (inviteToken.data.email === email) {
      return true;
    }
    return !!ConfigController.getInstance().config.teams.allowEmailMismatchForInvites;
  }

  async addUserToTeam(user: User, invitationToken: string) {
    if (!this.initialized) return;
    const inviteToken = await Token.getInstance().findOne({
      tokenType: TokenType.TEAM_INVITE_TOKEN,
      token: invitationToken,
    });
    if (!inviteToken) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Could not add user to team, invite token does not exist',
      );
    }
    if (
      inviteToken.data.email &&
      (!user.email || user.email !== inviteToken.data.email) &&
      !ConfigController.getInstance().config.teams.allowEmailMismatchForInvites
    ) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Could not add user to team, email does not match',
      );
    }
    const team = await Team.getInstance().findOne({ _id: inviteToken!.data.teamId });
    if (!team) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Could not add user to team, team does not exist',
      );
    }
    await this.grpcSdk.authorization!.createRelation({
      subject: 'User:' + user._id,
      relation: inviteToken!.data.role,
      resource: 'Team:' + team._id,
    });
    if (inviteToken.data.email) {
      await Token.getInstance().deleteOne({ _id: inviteToken!._id });
    }
  }

  async getUserInvites(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const invites = await Token.getInstance().findMany({
      tokenType: TokenType.TEAM_INVITE_TOKEN,
      // @ts-ignore
      'data.email': call.request.context.user.email,
    });
    return {
      invites: invites.map(invite => ({
        teamId: invite.data.teamId,
        invitationToken: invite.token,
        role: invite.data.role,
      })),
    };
  }

  async addUserToTeamRequest(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { teamId, userId, role } = call.request.params;
    const { user } = call.request.context;
    const config: Config = ConfigController.getInstance().config;
    const allowed = await this.grpcSdk.authorization!.can({
      subject: 'User:' + user._id,
      actions: ['invite'],
      resource: 'Team:' + teamId,
    });
    if (!allowed.allow || !config.teams.allowAddWithoutInvite) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Could not add user to team, user does not have permission ' +
          'or adding users without invite is disabled',
      );
    }
    const userToAdd = await User.getInstance().findOne({ _id: userId });
    if (!userToAdd) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Could not add user to team, user does not exist',
      );
    }
    await this.grpcSdk.authorization!.createRelation({
      subject: 'User:' + userId,
      relation: role || 'member',
      resource: 'Team:' + teamId,
    });
    return 'User added to team';
  }

  async addUserToDefault(user: User) {
    if (!this.initialized) return;
    const config: Config = ConfigController.getInstance().config;
    if (!config.teams.enableDefaultTeam) return;
    const team = await Team.getInstance().findOne({ isDefault: true });
    if (!team) {
      return;
    }
    await this.grpcSdk.authorization!.createRelation({
      subject: 'User:' + user._id,
      relation: 'member',
      resource: 'Team:' + team._id,
    });
  }

  createUserInvitation(invite: {
    teamId: string;
    role?: string;
    email?: string;
    inviter: User;
    userData?: Indexable;
  }) {
    return Token.getInstance().create({
      tokenType: TokenType.TEAM_INVITE_TOKEN,
      token: uuid(),
      data: {
        teamId: invite.teamId,
        role: invite.role || 'member',
        email: invite.email,
        userData: invite.userData,
      },
      user: invite.inviter._id,
    });
  }

  async acceptInvite(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { invitationToken } = call.request.params;
    await this.addUserToTeam(user, invitationToken);
    return 'OK';
  }

  async getInvitationTokenUserData(
    call: ParsedRouterRequest,
  ): Promise<UnparsedRouterResponse> {
    const { invitationToken } = call.request.params;
    const inviteToken = await Token.getInstance().findOne({
      tokenType: TokenType.TEAM_INVITE_TOKEN,
      token: invitationToken,
    });
    if (!inviteToken) {
      throw new GrpcError(status.NOT_FOUND, 'Invitation token not found');
    }
    return {
      email: inviteToken.data.email,
      userData: inviteToken.data.userData ?? {},
    };
  }

  async createTeam(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { name, parentTeam, addCreatorToTeam } = call.request.params;

    if (parentTeam) {
      const allowed = await this.grpcSdk.authorization!.can({
        subject: 'User:' + user._id,
        actions: ['edit'],
        resource: 'Team:' + parentTeam,
      });
      if (!allowed.allow) {
        throw new GrpcError(
          status.PERMISSION_DENIED,
          'User does not have permission to create a subteam',
        );
      }
    }
    const existingTeam = await Team.getInstance().findOne({ name, parentTeam });
    if (existingTeam) {
      throw new GrpcError(status.ALREADY_EXISTS, 'A team with that name already exists');
    }

    const team = await Team.getInstance().create({
      name,
      parentTeam: parentTeam || null,
      isDefault: false,
    });

    if (parentTeam) {
      await this.grpcSdk.authorization!.createRelation({
        subject: 'Team:' + parentTeam,
        relation: 'owner',
        resource: 'Team:' + team._id,
      });
    }
    if (!parentTeam || addCreatorToTeam) {
      await this.grpcSdk.authorization!.createRelation({
        subject: 'User:' + user._id,
        relation: 'owner',
        resource: 'Team:' + team._id,
      });
    }

    return team;
  }

  async deleteTeam(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { teamId } = call.request.params;
    if (!call.request.context.jwtPayload.sudo) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'Re-login required to enter sudo mode',
      );
    }
    const existingTeam = await Team.getInstance().findOne({ _id: teamId });
    if (!existingTeam) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Team does not exist');
    }

    const can = await this.grpcSdk.authorization!.can({
      subject: 'User:' + user._id,
      actions: ['delete'],
      resource: 'Team:' + teamId,
    });
    if (!can.allow) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'User does not have permission to delete this team',
      );
    }
    await Team.getInstance().deleteOne({ _id: teamId });
    await this.grpcSdk.authorization!.deleteAllRelations({
      resource: 'Team:' + teamId,
    });
    await this.grpcSdk.authorization!.deleteAllRelations({
      subject: 'Team:' + teamId,
    });
    return 'Deleted';
  }

  async updateTeam(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { teamId } = call.request.urlParams;
    const { name } = call.request.bodyParams;
    const existingTeam = await Team.getInstance().findOne({ _id: teamId });
    if (!existingTeam) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Team does not exist');
    }

    const can = await this.grpcSdk.authorization!.can({
      subject: 'User:' + user._id,
      actions: ['edit'],
      resource: 'Team:' + teamId,
    });
    if (!can.allow) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'User does not have permission to edit this team',
      );
    }
    const team = await Team.getInstance().findByIdAndUpdate(teamId, { name });
    return team!;
  }

  async removeTeamMembers(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { teamId, members } = call.request.params;
    const targetTeam = await Team.getInstance().findOne({ _id: teamId });
    if (!targetTeam) {
      throw new GrpcError(status.NOT_FOUND, 'Team does not exist');
    }
    if (!members || members.length === 0) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'members is required and must be a non-empty array',
      );
    }
    if (members.indexOf(user._id) !== -1) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Cannot remove self from team');
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
    const allowed = await this.grpcSdk.authorization!.can({
      subject: 'User:' + user._id,
      actions: ['edit'],
      resource: 'Team:' + teamId,
    });
    if (!allowed.allow) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'User does not have permission to remove team members',
      );
    }
    let deletionError = false;
    for (const member of members) {
      const relation = await this.grpcSdk.authorization!.findRelation({
        subject: 'User:' + member,
        resource: 'Team:' + teamId,
      });
      if (!relation || relation.relations.length === 0) {
        continue;
      }
      const memberRole = relation.relations[0].relation;
      if (memberRole === 'owner') {
        const allowed = await this.grpcSdk.authorization!.can({
          subject: 'User:' + user._id,
          actions: ['deleteOwners'],
          resource: 'Team:' + teamId,
        });
        if (!allowed.allow) {
          deletionError = true;
          continue;
        }
      }
      await this.grpcSdk.authorization!.deleteAllRelations({
        subject: 'User:' + member,
        resource: 'Team:' + teamId,
      });
    }
    if (deletionError) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'One or more members were not deleted',
      );
    }
    return 'Users removed from team';
  }

  async getTeamMembers(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { teamId, search, sort, populate } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;

    const allowed = await this.grpcSdk.authorization!.can({
      subject: 'User:' + user._id,
      actions: ['viewMembers'],
      resource: 'Team:' + teamId,
    });
    if (!allowed.allow) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'User does not have permission to view team members',
      );
    }
    const relations = await this.grpcSdk.authorization!.findRelation({
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
      populate,
    });
    return { members: members, count };
  }

  async getTeam(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { teamId, populate } = call.request.params;
    const allowed = await this.grpcSdk.authorization?.can({
      subject: 'User:' + user._id,
      actions: ['read'],
      resource: 'Team:' + teamId,
    });
    if (!allowed || !allowed.allow) {
      const relations = await this.grpcSdk.authorization!.findRelation({
        subject: 'User:' + user._id,
        resource: 'Team:' + teamId,
        skip: 0,
        limit: 1,
      });
      if (!relations || relations.relations.length === 0) {
        throw new GrpcError(
          status.PERMISSION_DENIED,
          'User does not have permission to view team',
        );
      }
    }
    const team: Team | null = await Team.getInstance().findOne(
      { _id: teamId },
      undefined,
      populate,
    );
    return team || 'Team not found';
  }

  async getUserTeams(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { search, sort, populate } = call.request.params;
    const skip = call.request.params.skip ?? 0;
    const limit = call.request.params.limit ?? 25;

    const relations = await this.grpcSdk.authorization!.findRelation({
      subject: 'User:' + user._id,
      resourceType: 'Team',
      skip,
      limit,
    });
    if (!relations || relations.relations.length === 0) {
      return { teams: [], count: 0 };
    }
    const { teams, count } = await AuthUtils.fetchUserTeams({
      relations,
      search,
      skip,
      limit,
      sort,
      populate,
    });
    return { teams: teams, count };
  }

  async getSubTeams(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { teamId, search, sort, populate } = call.request.params;
    const skip = call.request.params.skip ?? 0;
    const limit = call.request.params.limit ?? 25;

    const allowed = await this.grpcSdk.authorization!.can({
      subject: 'User:' + user._id,
      actions: ['viewSubTeams'],
      resource: 'Team:' + teamId,
    });
    if (!allowed.allow) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'User does not have permission to view subteams',
      );
    }
    const relations = await this.grpcSdk.authorization!.findRelation({
      subject: 'Team:' + teamId,
      relation: 'owner',
      resourceType: 'Team',
      skip,
      limit,
    });

    if (!relations || relations.relations.length === 0) {
      return { teams: [], count: 0 };
    }
    const { teams, count } = await AuthUtils.fetchUserTeams({
      relations,
      search,
      skip,
      limit,
      sort,
      populate,
    });
    return { teams, count };
  }

  async userInvite(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { teamId, email, role, redirectUri, userData } = call.request.params;
    const config: Config = ConfigController.getInstance().config;
    if (!config.teams.invites.enabled) {
      throw new GrpcError(status.PERMISSION_DENIED, 'Team invites are disabled');
    }
    const team = await Team.getInstance().findOne({ _id: teamId });
    if (!team) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Could not create invite, team does not exist',
      );
    }
    const existingUser = await User.getInstance().findOne({ _id: user._id });
    if (!existingUser) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Could not create invite, user does not exist',
      );
    }
    const can = await this.grpcSdk.authorization!.can({
      subject: 'User:' + user._id,
      actions: ['invite'],
      resource: 'Team:' + teamId,
    });
    if (!can.allow) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'You do not have permission to invite users to this team',
      );
    }

    // Delete any existing invite for the same email and team
    await Token.getInstance().deleteOne({
      tokenType: TokenType.TEAM_INVITE_TOKEN,
      // @ts-expect-error Unsafe nested property access
      'data.teamId': teamId,
      'data.email': email,
    });

    const invitation = await this.createUserInvitation({
      teamId,
      email,
      role,
      inviter: user,
      userData,
    });
    if (email && config.teams.invites.sendEmail && this.grpcSdk.isAvailable('email')) {
      let link = !isEmpty(redirectUri)
        ? AuthUtils.validateRedirectUri(redirectUri)
        : config.teams.invites.inviteUrl;
      link += `?invitationToken=${invitation.token}`;

      await this.grpcSdk
        .emailProvider!.sendEmail('TeamInvite', {
          email: email,
          variables: {
            link,
            teamName: team.name,
            inviterName: user.name,
            userData,
          },
        })
        .catch(e => {
          ConduitGrpcSdk.Logger.error(e);
        });
    }
    return invitation.token;
  }

  async getTeamInvites(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { teamId } = call.request.urlParams;
    const config: Config = ConfigController.getInstance().config;
    if (!config.teams.invites.enabled) {
      throw new GrpcError(status.PERMISSION_DENIED, 'Team invites are disabled');
    }
    const team = await Team.getInstance().findOne({ _id: teamId });
    if (!team) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Could not create invite, team does not exist',
      );
    }

    const can = await this.grpcSdk.authorization!.can({
      subject: 'User:' + user._id,
      actions: ['invite'],
      resource: 'Team:' + teamId,
    });
    if (!can.allow) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'You do not have permission to invite users to this team',
      );
    }

    const invites = await Token.getInstance().findMany({
      tokenType: TokenType.TEAM_INVITE_TOKEN,
      // @ts-expect-error Unsafe nested property access
      'data.teamId': teamId,
    });

    const count = await Token.getInstance().countDocuments({
      tokenType: TokenType.TEAM_INVITE_TOKEN,
      // @ts-expect-error Unsafe nested property access
      'data.teamId': teamId,
    });

    return {
      invites,
      count,
    };
  }

  async persistentInvite(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { teamId, role, userData } = call.request.params;
    const config = ConfigController.getInstance().config;
    if (!config.teams.invites.enabled) {
      throw new GrpcError(status.PERMISSION_DENIED, 'Team invites are disabled');
    }
    const team = await Team.getInstance().findOne({ _id: teamId });
    if (!team) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Could not create invite, team does not exist',
      );
    }
    const isOwner = await this.grpcSdk.authorization!.findRelation({
      subject: 'User:' + user._id,
      resource: 'Team:' + teamId,
      relation: 'owner',
    });
    if (!isOwner) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'You do not have permission to invite users to this team',
      );
    }
    const invitation = await this.createUserInvitation({
      teamId,
      role,
      inviter: user,
      userData,
    });
    return invitation.token;
  }

  async deletePersistentInvitation(
    call: ParsedRouterRequest,
  ): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { teamId, invitationToken } = call.request.params;
    const config: Config = ConfigController.getInstance().config;
    if (!config.teams.invites.enabled) {
      throw new GrpcError(status.PERMISSION_DENIED, 'Team invites are disabled');
    }
    const team = await Team.getInstance().findOne({ _id: teamId });
    if (!team) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Could not create invite, team does not exist',
      );
    }
    const isOwner = await this.grpcSdk.authorization!.findRelation({
      subject: 'User:' + user._id,
      resource: 'Team:' + teamId,
      relation: 'owner',
    });
    if (!isOwner) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'You do not have permission to invite users to this team',
      );
    }
    const foundToken = await Token.getInstance().findOne({
      token: invitationToken,
      'data.teamId': teamId,
    } as Query<Token>);
    if (!foundToken) {
      throw new GrpcError(status.NOT_FOUND, 'Token not found');
    }
    await Token.getInstance().deleteOne({ _id: foundToken._id });
    return 'Invitation token deleted';
  }

  async modifyMembersRoles(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { teamId, members, role } = call.request.params;
    const targetTeam = await Team.getInstance().findOne({ _id: teamId });
    if (!targetTeam) {
      throw new GrpcError(status.NOT_FOUND, 'Team does not exist');
    }
    await AuthUtils.validateMembers(members);
    if (members.indexOf(user._id) !== -1) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Cannot change self role');
    }
    const allowed = await this.grpcSdk.authorization!.can({
      subject: 'User:' + user._id,
      actions: ['edit'],
      resource: 'Team:' + teamId,
    });
    if (!allowed.allow) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'User does not have permission to modify team members',
      );
    }

    for (const member of members) {
      const relation = await this.grpcSdk.authorization!.findRelation({
        subject: 'User:' + member,
        resource: 'Team:' + teamId,
      });
      if (!relation || relation.relations.length === 0) {
        continue;
      }
      await this.grpcSdk.authorization!.deleteAllRelations({
        subject: 'User:' + member,
        resource: 'Team:' + teamId,
      });
      await this.grpcSdk.authorization!.createRelation({
        subject: 'User:' + member,
        resource: 'Team:' + teamId,
        relation: role,
      });
    }
    return 'ok';
  }

  declareRoutes(routingManager: RoutingManager): void {
    const config: Config = ConfigController.getInstance().config;
    const authRouteMiddlewares = ['authMiddleware'];
    if (config.anonymousUsers) {
      authRouteMiddlewares.push('denyAnonymousMiddleware');
    }
    routingManager.route(
      {
        path: '/teams',
        description: `Creates a new team. If addCreatorToTeam is true, the current user will be added as an owner when providing a parent team.`,
        bodyParams: {
          name: ConduitString.Required,
          addCreatorToTeam: ConduitBoolean.Optional,
          parentTeam: ConduitString.Optional,
        },
        action: ConduitRouteActions.POST,
        middlewares: authRouteMiddlewares,
      },
      new ConduitRouteReturnDefinition(Team.name),
      this.createTeam.bind(this),
    );
    routingManager.route(
      {
        path: '/teams',
        description: `Retrieves the current user's teams.`,
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          search: ConduitString.Optional,
          sort: ConduitString.Optional,
        },
        action: ConduitRouteActions.GET,
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('GetUserTeams', {
        teams: [Team.name],
        count: ConduitNumber.Required,
      }),
      this.getUserTeams.bind(this),
    );
    routingManager.route(
      {
        path: '/teams/invites',
        description: `Gets pending team invites.`,
        action: ConduitRouteActions.GET,
        middlewares: authRouteMiddlewares,
      },
      new ConduitRouteReturnDefinition('Invites', {
        invites: [
          {
            teamId: ConduitObjectId.Required,
            invitationToken: ConduitString.Required,
            role: ConduitString.Required,
          },
        ],
      }),
      this.getUserInvites.bind(this),
    );
    routingManager.route(
      {
        path: '/teams/:teamId/members',
        description: `Deletes the specified users from a team.`,
        urlParams: {
          teamId: ConduitObjectId.Required,
        },
        queryParams: {
          members: { type: [TYPE.ObjectId], required: true },
        },
        action: ConduitRouteActions.DELETE,
        middlewares: authRouteMiddlewares,
      },
      new ConduitRouteReturnDefinition('DeleteTeamMembersResponse', 'String'),
      this.removeTeamMembers.bind(this),
    );
    routingManager.route(
      {
        path: '/teams/:teamId',
        description: `Deletes a team.`,
        urlParams: {
          teamId: ConduitObjectId.Required,
        },
        action: ConduitRouteActions.DELETE,
        middlewares: authRouteMiddlewares,
      },
      new ConduitRouteReturnDefinition('DeleteTeam', 'String'),
      this.deleteTeam.bind(this),
    );
    routingManager.route(
      {
        path: '/teams/:teamId',
        description: `Updates a team. Currently only supports changing the team name.`,
        urlParams: {
          teamId: ConduitObjectId.Required,
        },
        bodyParams: {
          name: ConduitString.Required,
        },
        action: ConduitRouteActions.PATCH,
        middlewares: authRouteMiddlewares,
      },
      new ConduitRouteReturnDefinition(Team.name),
      this.updateTeam.bind(this),
    );
    routingManager.route(
      {
        path: '/teams/:teamId',
        description: `Gets a team.`,
        urlParams: {
          teamId: ConduitObjectId.Required,
        },
        action: ConduitRouteActions.GET,
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('Team'),
      this.getTeam.bind(this),
    );
    routingManager.route(
      {
        path: '/teams/:teamId/members',
        description: `Retrieves members of a team`,
        urlParams: {
          teamId: ConduitObjectId.Required,
        },
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          search: ConduitString.Optional,
          sort: ConduitString.Optional,
        },
        action: ConduitRouteActions.GET,
        middlewares: authRouteMiddlewares,
      },
      new ConduitRouteReturnDefinition('GetTeamMembers', {
        members: [User.name],
        count: ConduitNumber.Required,
      }),
      this.getTeamMembers.bind(this),
    );
    routingManager.route(
      {
        path: '/teams/:teamId/teams',
        description: `Retrieves sub-teams of a team`,
        urlParams: {
          teamId: ConduitObjectId.Required,
        },
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          search: ConduitString.Optional,
          sort: ConduitString.Optional,
        },
        action: ConduitRouteActions.GET,
        middlewares: authRouteMiddlewares,
      },
      new ConduitRouteReturnDefinition('GetTeamTeams', {
        teams: [Team.name],
        count: ConduitNumber.Required,
      }),
      this.getSubTeams.bind(this),
    );
    routingManager.route(
      {
        path: '/teams/:teamId/invites',
        description: `Retrieves pending invites for the team`,
        urlParams: {
          teamId: ConduitObjectId.Required,
        },
        action: ConduitRouteActions.GET,
        middlewares: authRouteMiddlewares,
      },
      new ConduitRouteReturnDefinition('GetTeamInvites', {
        invites: [Token.name],
        count: ConduitNumber.Required,
      }),
      this.getTeamInvites.bind(this),
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
        middlewares: authRouteMiddlewares,
        name: 'ModifyMembersRoles',
        description: 'Modifies the roles of members in a team',
      },
      new ConduitRouteReturnDefinition('ModifyMembersRoles', 'String'),
      this.modifyMembersRoles.bind(this),
    );
    routingManager.route(
      {
        path: '/teams/invite/accept',
        description: `Accepts an invite from another user.`,
        queryParams: {
          invitationToken: ConduitString.Required,
        },
        action: ConduitRouteActions.GET,
        middlewares: authRouteMiddlewares,
      },
      new ConduitRouteReturnDefinition('InviteAccepted', 'String'),
      this.acceptInvite.bind(this),
    );
    routingManager.route(
      {
        path: '/teams/invite/user/data',
        description: `Returns user data of an invitation token.`,
        queryParams: {
          invitationToken: ConduitString.Required,
        },
        action: ConduitRouteActions.GET,
      },
      new ConduitRouteReturnDefinition('GetInvitationTokenUserData', {
        email: ConduitString.Required,
        userData: ConduitJson.Optional,
      }),
      this.getInvitationTokenUserData.bind(this),
    );
    routingManager.route(
      {
        path: '/teams/:teamId/invite',
        description: `Creates a new invite to add a user to a team.`,
        urlParams: {
          teamId: ConduitObjectId.Required,
        },
        bodyParams: {
          role: ConduitString.Required,
          email: ConduitString.Required,
          redirectUri: ConduitString.Optional,
          userData: ConduitJson.Optional,
        },
        action: ConduitRouteActions.POST,
        middlewares: authRouteMiddlewares,
      },
      new ConduitRouteReturnDefinition('InvitationToken', 'String'),
      this.userInvite.bind(this),
    );
    routingManager.route(
      {
        path: '/teams/:teamId/invite/persistent',
        description: `Creates a persistent invitation token to add multiple users to a team.`,
        urlParams: {
          teamId: ConduitObjectId.Required,
        },
        bodyParams: {
          role: ConduitString.Required,
          userData: ConduitJson.Optional,
        },
        action: ConduitRouteActions.POST,
        middlewares: authRouteMiddlewares,
      },
      new ConduitRouteReturnDefinition('PersistentInvitationToken', 'String'),
      this.persistentInvite.bind(this),
    );
    routingManager.route(
      {
        path: '/teams/:teamId/invite/persistent',
        description: `Deletes a persistent invitation token of a team.`,
        urlParams: {
          teamId: ConduitObjectId.Required,
        },
        queryParams: {
          invitationToken: ConduitString.Required,
        },
        action: ConduitRouteActions.DELETE,
        middlewares: authRouteMiddlewares,
      },
      new ConduitRouteReturnDefinition('DeletePersistentInvitationToken', 'String'),
      this.deletePersistentInvitation.bind(this),
    );
    if (config.teams.allowAddWithoutInvite) {
      routingManager.route(
        {
          path: '/teams/:teamId/add',
          description: `Adds an existing user to a team without an invite.`,
          urlParams: {
            teamId: ConduitObjectId.Required,
          },
          bodyParams: {
            role: ConduitString.Optional,
            userId: ConduitObjectId.Required,
          },
          action: ConduitRouteActions.POST,
          middlewares: authRouteMiddlewares,
        },
        new ConduitRouteReturnDefinition('AddUserToTeam', 'String'),
        this.addUserToTeamRequest.bind(this),
      );
    }
  }

  async validate() {
    const config: Config = ConfigController.getInstance().config;
    if (config.teams.enabled && this.grpcSdk.isAvailable('authorization')) {
      await this.grpcSdk.authorization!.defineResource(TeamAuthz);
      if (this.initialized) return true;

      if (config.teams.enableDefaultTeam) {
        const existingTeam = await Team.getInstance().findOne({ isDefault: true });
        if (!existingTeam) {
          await Team.getInstance().create({
            name: 'Default Team',
            isDefault: true,
          });
        }
      }
      if (config.teams.invites.enabled && config.teams.invites.sendEmail) {
        if (!config.teams.invites.sendEmail || !this.grpcSdk.isAvailable('email')) {
          ConduitGrpcSdk.Logger.warn(
            'Team invites are enabled, but email sending is disabled. No invites will be sent.',
          );
        }
        if (config.teams.invites.sendEmail) {
          this.grpcSdk.onceModuleUp('email', async () => {
            await this.grpcSdk.emailProvider!.registerTemplate(TeamInviteTemplate);
          });
        }
      }
      ConduitGrpcSdk.Logger.log('Teams are available');
      return (this.initialized = true);
    }
    return (this.initialized = false);
  }
}
