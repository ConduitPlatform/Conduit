import ConduitGrpcSdk, {
  ConduitNumber,
  ConduitObjectId,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  ConfigController,
  GrpcError,
  ParsedRouterRequest,
  RoutingManager,
  TYPE,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { Team as TeamAuthz, User as UserAuthz } from '../authz';
import { Team } from '../models/Team.schema';
import { Token, User } from '../models';
import { TokenType } from '../constants/TokenType';
import { status } from '@grpc/grpc-js';
import { Config } from '../config';
import { IAuthenticationStrategy } from '../interfaces/AuthenticationStrategy';
import { TeamInviteTemplate } from '../templates';
import { isNil } from 'lodash';
import escapeStringRegexp from 'escape-string-regexp';

export class TeamsHandler implements IAuthenticationStrategy {
  private initialized = false;
  private static _instance?: TeamsHandler;

  private constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  public static getInstance(grpcSdk?: ConduitGrpcSdk) {
    if (TeamsHandler._instance) return TeamsHandler._instance;
    if (!grpcSdk) throw new Error('GrpcSdk not provided');
    TeamsHandler._instance = new TeamsHandler(grpcSdk);
    return TeamsHandler._instance;
  }

  async initialize() {
    await this.grpcSdk.authorization!.defineResource(UserAuthz);
    await this.grpcSdk.authorization!.defineResource(TeamAuthz);
    const existingTeam = await Team.getInstance().findOne({ isDefault: true });
    if (!existingTeam) {
      await Team.getInstance().create({
        name: 'Default Team',
        isDefault: true,
      });
    }
  }

  async addUserToTeam(user: User, invitationToken: string) {
    const inviteToken = await Token.getInstance().findOne({
      type: TokenType.TEAM_INVITE_TOKEN,
      token: invitationToken,
    });
    if (!inviteToken) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Could not join user to team, invite token not found',
      );
    }
    if (
      inviteToken.data.email &&
      (!user.email || user.email !== inviteToken.data.email)
    ) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Could not join user to team, email does not match',
      );
    }
    const team = await Team.getInstance().findOne({ _id: inviteToken!.data.teamId });
    if (!team) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Could not join user to team, team not found',
      );
    }
    await this.grpcSdk.authorization!.createRelation({
      subject: 'User:' + user._id,
      relation: inviteToken!.data.role,
      resource: 'Team:' + team._id,
    });
    await Token.getInstance().deleteOne({ _id: inviteToken!._id });
  }

  createUserInvitation(invite: {
    teamId: string;
    role?: string;
    email?: string;
    inviter: User;
  }) {
    return Token.getInstance().create({
      type: TokenType.TEAM_INVITE_TOKEN,
      data: {
        teamId: invite.teamId,
        role: invite.role || 'member',
        email: invite.email,
      },
      user: invite.inviter,
    });
  }

  async acceptInvite(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { invitationToken } = call.request.params;
    await this.addUserToTeam(user, invitationToken);
    return 'OK';
  }

  async createTeam(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { name, parentTeam } = call.request.params;

    if (parentTeam) {
      const allowed = await this.grpcSdk.authorization!.can({
        subject: 'User:' + user._id,
        actions: ['edit'],
        resource: 'Team:' + parentTeam,
      });
      if (!allowed) {
        throw new GrpcError(
          status.PERMISSION_DENIED,
          'User does not have permission to create a subteam',
        );
      }
    }
    const existingTeam = await Team.getInstance().findOne({ name });
    if (existingTeam) {
      throw new GrpcError(status.ALREADY_EXISTS, 'A team with that name already exists');
    }

    const team = await Team.getInstance().create({
      name,
      parentTeam: parentTeam || null,
      isDefault: false,
    });

    await this.grpcSdk.authorization!.createRelation({
      subject: 'User:' + user._id,
      relation: 'owner',
      resource: 'Team:' + team._id,
    });
    if (parentTeam) {
      await this.grpcSdk.authorization!.createRelation({
        subject: 'Team:' + parentTeam,
        relation: 'owner',
        resource: 'Team:' + team._id,
      });
    }

    return team;
  }

  async deleteTeam(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { id } = call.request.params;
    if (!call.request.context.jwtPayload.sudo) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'Re-login required to enter sudo mode',
      );
    }
    const existingTeam = await Team.getInstance().findOne({ _id: id });
    if (!existingTeam) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Team does not exist');
    }

    const can = await this.grpcSdk.authorization!.can({
      subject: 'User:' + user._id,
      actions: ['delete'],
      resource: 'Team:' + id,
    });
    if (!can.allow) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'User does not have permission to delete this team',
      );
    }
    await Team.getInstance().deleteOne({ _id: id });
    await this.grpcSdk.authorization!.deleteAllRelations({
      resource: 'Team:' + id,
    });
    await this.grpcSdk.authorization!.deleteAllRelations({
      subject: 'Team:' + id,
    });
    return 'Deleted';
  }

  async removeTeamMembers(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { team, members } = call.request.params;
    const targetTeam = await Team.getInstance().findOne({ _id: team });
    if (!targetTeam) {
      throw new GrpcError(status.NOT_FOUND, 'Team not found');
    }
    if (members.indexOf(user._id) !== -1) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Cannot remove self from team');
    }
    const allowed = await this.grpcSdk.authorization!.can({
      subject: 'User:' + user._id,
      actions: ['edit'],
      resource: 'Team:' + team,
    });
    if (!allowed) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'User does not have permission to remove team members',
      );
    }
    for (const member of members) {
      await this.grpcSdk.authorization!.deleteAllRelations({
        subject: 'User:' + member,
        resource: 'Team:' + team,
      });
    }
    return 'Users removed from team';
  }

  async getTeamMembers(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { team } = call.request.params;
    const { search, sort } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;

    const allowed = await this.grpcSdk.authorization!.can({
      subject: 'User:' + user._id,
      actions: ['read'],
      resource: 'Team:' + team,
    });
    if (!allowed) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'User does not have permission to view team members',
      );
    }
    const relations = await this.grpcSdk.authorization!.findRelation({
      resource: 'Team:' + team,
      relation: 'member',
    });
    if (!relations || relations.relations.length === 0) {
      return { members: [], count: 0 };
    }

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

  async userInvite(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { teamId, email, role } = call.request.params;
    const config: Config = ConfigController.getInstance().config;
    if (!config.teams.invites.enabled) {
      throw new GrpcError(status.PERMISSION_DENIED, 'Team invites are disabled');
    }
    const team = await Team.getInstance().findOne({ _id: teamId });
    if (!team) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Could not create invite, team not found',
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

    const invitation = await this.createUserInvitation({
      teamId,
      email,
      role,
      inviter: user,
    });
    if (email && config.teams.invites.sendEmail && this.grpcSdk.isAvailable('email')) {
      const link = `${config.teams.invites.inviteUrl}?invitationToken=${invitation.token}`;
      await this.grpcSdk
        .emailProvider!.sendEmail('TeamInvite', {
          email: email,
          sender: 'no-reply',
          variables: {
            link,
            teamName: team.name,
            inviterName: user.name,
          },
        })
        .catch(e => {
          ConduitGrpcSdk.Logger.error(e);
        });
    }
    return invitation.token;
  }

  async modifyRoles(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { team, members, role } = call.request.params;
    const targetTeam = await Team.getInstance().findOne({ _id: team });
    if (!targetTeam) {
      throw new GrpcError(status.NOT_FOUND, 'Team not found');
    }
    if (members.indexOf(user._id) !== -1) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Cannot change self role');
    }
    const allowed = await this.grpcSdk.authorization!.can({
      subject: 'User:' + user._id,
      actions: ['edit'],
      resource: 'Team:' + team,
    });
    if (!allowed) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'User does not have permission to remove team members',
      );
    }

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
    return 'ok';
  }

  declareRoutes(routingManager: RoutingManager): void {
    routingManager.route(
      {
        path: '/team',
        description: `Creates a new team.`,
        bodyParams: {
          name: ConduitString.Required,
          parentTeam: ConduitString.Optional,
        },
        action: ConduitRouteActions.POST,
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition(Team.name),
      this.createTeam.bind(this),
    );

    routingManager.route(
      {
        path: '/team/members',
        description: `Deletes the specified users from a team.`,
        queryParams: {
          team: ConduitString.Required,
          members: { type: [TYPE.ObjectId], required: true },
        },
        action: ConduitRouteActions.DELETE,
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('DeleteTeamMembersResponse', 'String'),
      this.removeTeamMembers.bind(this),
    );
    routingManager.route(
      {
        path: '/team/:id',
        description: `Deletes a team.`,
        urlParams: {
          id: ConduitString.Required,
        },
        action: ConduitRouteActions.DELETE,
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('DeleteTeam', 'String'),
      this.deleteTeam.bind(this),
    );
    routingManager.route(
      {
        path: '/team/members/:team',
        description: `Retrieves members of a team`,
        urlParams: {
          team: ConduitString.Required,
        },
        action: ConduitRouteActions.GET,
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('GetTeamMembers', {
        members: [User.name],
        count: ConduitNumber.Required,
      }),
      this.getTeamMembers.bind(this),
    );
    routingManager.route(
      {
        path: '/teams/members/:team',
        action: ConduitRouteActions.PATCH,
        urlParams: {
          team: ConduitObjectId.Required,
        },
        bodyParams: {
          members: {
            type: [TYPE.ObjectId],
            required: true,
          },
          role: { type: TYPE.String, required: true },
        },
        name: 'ChangeMemberRole',
        description: 'Changes the roles of members in a team',
      },
      new ConduitRouteReturnDefinition('ChangeMemberRole', 'String'),
      this.modifyRoles.bind(this),
    );
    routingManager.route(
      {
        path: '/team/invite/accept',
        description: `Accepts an invite from another user.`,
        queryParams: {
          invitationToken: ConduitString.Required,
        },
        action: ConduitRouteActions.GET,
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('InviteAccepted', 'String'),
      this.acceptInvite.bind(this),
    );
    routingManager.route(
      {
        path: '/team/invite',
        description: `Creates a new invite to join a user to a team.`,
        bodyParams: {
          teamId: ConduitString.Required,
          role: ConduitString.Optional,
          email: ConduitString.Optional,
        },
        action: ConduitRouteActions.POST,
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('InvitationToken', 'String'),
      this.userInvite.bind(this),
    );
  }

  async validate(): Promise<boolean> {
    const config: Config = ConfigController.getInstance().config;
    if (!config.teams.enabled) {
      return (this.initialized = false);
    }
    await this.initialize();
    if (config.teams.invites.enabled && !config.teams.invites.sendEmail) {
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
    return this.initialized;
  }
}
