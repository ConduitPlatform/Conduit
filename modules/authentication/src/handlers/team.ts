import ConduitGrpcSdk, { GrpcError } from '@conduitplatform/grpc-sdk';
import { Team as TeamAuthz, User as UserAuthz } from '../authz';
import { Team } from '../models/Team.schema';
import { Token, User } from '../models';
import { TokenType } from '../constants/TokenType';
import { status } from '@grpc/grpc-js';

export class TeamsHandler {
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
}
