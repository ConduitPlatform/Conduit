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
      role: { $in: roles.map(role => role._id) },
      user: user._id,
    });
    if (isNil(userMembership)) {
      throw new GrpcError(status.PERMISSION_DENIED, 'User does not have invite access');
    }
    const requestedRole = await Role.getInstance().findOne({
      _id: inviteeRole,
    });
    if (isNil(requestedRole)) {
      throw new GrpcError(status.NOT_FOUND, 'Role does not exist');
    }
    let permissions:
      | {
          canInvite: boolean;
          canRemove: boolean;
          canDeleteGroup: boolean;
          canCreateGroup: boolean;
        }
      | any = {
      canInvite: false,
      canRemove: false,
      canDeleteGroup: false,
      canCreateGroup: false,
    };
    roles.forEach(role => {
      Object.keys(role.permissions).forEach(permission => {
        if (isNil(permissions[permission])) {
          permissions[permission] = role.permissions[permission];
        } else if (!permissions[permission] && role.permissions[permission]) {
          permissions[permission] = role.permissions[permission];
        }
      });
    });
    let elevatedPermissions = false;
    Object.keys(permissions).forEach(permission => {
      if (!permissions[permission] && requestedRole.permissions[permission]) {
        elevatedPermissions = true;
      }
    });
    if (elevatedPermissions) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'Cannot invite user with elevated permissions',
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

  async userInvites(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {}

  async inviteResponse(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {}

  async removeFromGroup(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {}

  async modifyUserRole(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {}

  async createGroup(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {}

  async editGroup(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {}

  async deleteRole(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {}

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
