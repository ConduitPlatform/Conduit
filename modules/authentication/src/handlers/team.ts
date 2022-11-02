import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  ConfigController,
  GrpcError,
  ParsedRouterRequest,
  RoutingManager,
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
    let existingTeam = await Team.getInstance().findOne({ isDefault: true });
    if (!existingTeam) {
      await Team.getInstance().create({
        name: 'Default Team',
        isDefault: true,
      });
    }
  }

  async addUserToTeam(user: User, inviteId: string) {
    let inviteToken = await Token.getInstance().findOne({
      type: TokenType.TEAM_INVITE_TOKEN,
      token: inviteId,
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
    const { inviteId } = call.request.params;
    await this.addUserToTeam(user, inviteId);
    return 'OK';
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
      action: 'invite',
      resource: 'Team:' + teamId,
    });
    if (!can.allow) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'You do not have permission to invite users to this team',
      );
    }

    let invitation = await this.createUserInvitation({
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

  declareRoutes(routingManager: RoutingManager): void {
    routingManager.route(
      {
        path: '/user/accept-invite/:inviteId',
        description: `Accepts an invite from another user.`,
        urlParams: {
          inviteId: ConduitString.Required,
        },
        action: ConduitRouteActions.GET,
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('InviteAccepted', 'String'),
      this.acceptInvite.bind(this),
    );
    routingManager.route(
      {
        path: '/user/create-invite',
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
