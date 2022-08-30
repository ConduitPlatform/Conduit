import ConduitGrpcSdk, {
  ParsedRouterRequest,
  UnparsedRouterResponse,
  RoutingManager,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  GrpcError,
  Indexable,
} from '@conduitplatform/grpc-sdk';
import { IAuthenticationStrategy } from '../interfaces/AuthenticationStrategy';
import { Config } from '../config';
import { GroupMembership } from '../models/GroupMembership.schema';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import { Group, Role, Token, User } from '../models';
import { TokenType } from '../constants/TokenType';
import { v4 as uuid } from 'uuid';

export class GroupHandlers implements IAuthenticationStrategy {
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  async getGroups(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const groupMemberships = await GroupMembership.getInstance().findMany({
      user: user._id,
    });
    return { groupMemberships };
  }

  async getGroupRole(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { groupId } = call.request.params;
    const groupMembership = await GroupMembership.getInstance().findOne({
      group: groupId,
      user: user._id,
    });
    if (isNil(groupMembership)) {
      throw new GrpcError(status.NOT_FOUND, 'User is not a member of this group');
    }
    return groupMembership;
  }

  async inviteToGroup(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    // userId refers to the invitee
    const { groupId, inviteeId, inviteeRole } = call.request.params;
    const group = await Group.getInstance().findOne({
      _id: groupId,
    });
    if (isNil(group)) {
      throw new GrpcError(status.NOT_FOUND, 'Group does not exist');
    }
    const invitee = await User.getInstance().findOne({
      _id: inviteeId,
    });
    if (isNil(invitee)) {
      throw new GrpcError(status.NOT_FOUND, 'Invitee does not exist');
    }

    const roles = await Role.getInstance().findMany({
      group: groupId,
      permissions: {
        canInvite: true,
      },
    });
    if (isNil(roles) || roles.length === 0) {
      throw new GrpcError(status.PERMISSION_DENIED, 'User does not have invite access');
    }
    const userMembership = await GroupMembership.getInstance().findOne({
      group: groupId,
      roles: { $in: roles.map(role => role._id) },
      user: user._id,
    });
    if (isNil(userMembership)) {
      throw new GrpcError(status.PERMISSION_DENIED, 'User does not have invite access');
    }
    if (!(userMembership.roles as string[]).includes(inviteeRole._id)) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'Cannot assign role that current user does not have',
      );
    }
    await Token.getInstance().create({
      user: inviteeId,
      type: TokenType.GROUP_INVITE,
      data: {
        group: groupId,
        token: uuid(),
        invitedBy: user._id,
        role: inviteeRole,
      },
    });

    return 'User invited!';
  }

  async userInvites(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const tokens = await Token.getInstance().findMany({
      user: user._id,
      type: TokenType.GROUP_INVITE,
    });
    return { tokens };
  }

  async inviteResponse(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { inviteToken, response } = call.request.params;
    const invitation = await Token.getInstance().findOne({
      user: user._id,
      type: TokenType.GROUP_INVITE,
      token: inviteToken,
    });
    if (isNil(invitation)) {
      throw new GrpcError(status.NOT_FOUND, 'Invitation not found');
    }
    if (!response) {
      await Token.getInstance().deleteOne({
        _id: invitation._id,
      });
      return { message: 'Invitation declined' };
    }

    const group = await Group.getInstance().findOne({
      _id: invitation.data.group,
    });
    if (isNil(group)) {
      throw new GrpcError(status.NOT_FOUND, 'Group not found');
    }
    const role = await Role.getInstance().findOne({
      _id: invitation.data.role,
    });
    if (isNil(role)) {
      throw new GrpcError(status.NOT_FOUND, 'Role not found');
    }
    const groupMembership = await GroupMembership.getInstance().create({
      group: group._id,
      user: user._id,
      roles: [role._id],
    });
    await Token.getInstance().deleteOne({
      _id: invitation._id,
    });
    return { groupMembership };
  }

  async removeFromGroup(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { groupId } = call.request.params;
    let userId: string | null = call.request.params.userId;
    if (isNil(userId)) {
      await GroupMembership.getInstance().deleteOne({
        group: groupId,
        user: user._id,
      });
      return 'User removed from group';
    }

    let userToRemove = await User.getInstance().findOne({
      _id: userId,
    });
    if (isNil(userToRemove)) {
      throw new GrpcError(status.NOT_FOUND, 'User not found');
    }
    let removalRoles = await Role.getInstance().findMany({
      group: groupId,
      permissions: {
        canRemove: true,
      },
    });

    let userRole = await GroupMembership.getInstance().findOne({
      group: groupId,
      user: user._id,
      roles: { $in: removalRoles.map(role => role._id) },
    });

    if (isNil(userRole)) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'User does not have permission to remove',
      );
    }

    await GroupMembership.getInstance().deleteOne({
      group: groupId,
      user: userToRemove._id,
    });
    return 'User removed from group!';
  }

  async modifyUserRole(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { groupId, userId, roles } = call.request.params;

    const userToModify = await User.getInstance().findOne({
      _id: userId,
    });
    if (isNil(userToModify)) {
      throw new GrpcError(status.NOT_FOUND, 'User not found');
    }
    const groupCheck = await GroupMembership.getInstance().findOne({
      group: groupId,
      user: userToModify._id,
    });
    if (isNil(groupCheck)) {
      throw new GrpcError(status.NOT_FOUND, 'User to modify is not in requested group');
    }
    const currentUserCheck = await GroupMembership.getInstance().findOne({
      group: groupId,
      user: user._id,
    });
    if (isNil(currentUserCheck)) {
      throw new GrpcError(status.NOT_FOUND, 'Current user not in requested group');
    }

    const validRoles = (currentUserCheck.roles as string[]).filter((role: string) => {
      return roles.includes(role);
    });
    if (validRoles.length !== roles.length) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'Cannot assign roles you do not have',
      );
    }
    await GroupMembership.getInstance().findByIdAndUpdate(
      groupCheck._id,
      {
        roles,
      },
      true,
    );

    return 'User roles updated!';
  }

  async createGroup(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    return 'User invited!';
  }

  async editGroup(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    return 'User invited!';
  }

  async deleteRole(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    return 'User invited!';
  }

  async createRole(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    return 'User invited!';
  }

  declareRoutes(routingManager: RoutingManager, config: Config): void {
    routingManager.route(
      {
        path: '/user/groups',
        description: `Returns the authenticated user's groups.`,
        action: ConduitRouteActions.GET,
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition(
        'GroupMembership',
        GroupMembership.getInstance().fields,
      ),
      this.getGroups.bind(this),
    );
    routingManager.route(
      {
        path: '/user',
        description: `Deletes the authenticated user.`,
        action: ConduitRouteActions.DELETE,
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('DeleteUserResponse', 'String'),
      this.getGroupRole.bind(this),
    );

    routingManager.route(
      {
        path: '/renew',
        action: ConduitRouteActions.POST,
        description: `Renews the access and refresh tokens 
              when provided with a valid refresh token.`,
        bodyParams: {
          refreshToken: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition('RenewAuthenticationResponse', {
        accessToken: ConduitString.Required,
        refreshToken: ConduitString.Required,
      }),
      this.inviteToGroup.bind(this),
    );

    routingManager.route(
      {
        path: '/logout',
        action: ConduitRouteActions.POST,
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('LogoutResponse', 'String'),
      this.userInvites.bind(this),
    );
    routingManager.route(
      {
        path: '/logout',
        action: ConduitRouteActions.POST,
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('LogoutResponse', 'String'),
      this.inviteResponse.bind(this),
    );

    routingManager.route(
      {
        path: '/logout',
        action: ConduitRouteActions.POST,
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('LogoutResponse', 'String'),
      this.removeFromGroup.bind(this),
    );

    routingManager.route(
      {
        path: '/logout',
        action: ConduitRouteActions.POST,
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('LogoutResponse', 'String'),
      this.modifyUserRole.bind(this),
    );
    routingManager.route(
      {
        path: '/logout',
        action: ConduitRouteActions.POST,
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('LogoutResponse', 'String'),
      this.createGroup.bind(this),
    );

    routingManager.route(
      {
        path: '/logout',
        action: ConduitRouteActions.POST,
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('LogoutResponse', 'String'),
      this.editGroup.bind(this),
    );
    routingManager.route(
      {
        path: '/logout',
        action: ConduitRouteActions.POST,
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('LogoutResponse', 'String'),
      this.deleteRole.bind(this),
    );
  }

  validate(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
