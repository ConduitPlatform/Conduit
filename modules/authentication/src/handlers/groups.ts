import ConduitGrpcSdk, {
  ConduitBoolean,
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
    return { invites: tokens };
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
    const { user } = call.request.context;
    const { name, parentGroup, isDefault, isRealm } = call.request.params;
    if (!isNil(parentGroup)) {
      const parentGroupCheck = await Group.getInstance().findOne({
        _id: parentGroup,
      });
      if (isNil(parentGroupCheck)) {
        throw new GrpcError(status.NOT_FOUND, 'Parent group not found');
      }
      // find role with permission to create group in parent group
      const parentGroupRoles = await Role.getInstance().findMany({
        group: parentGroup,
        permissions: {
          canCreateGroup: true,
        },
      });
      // check if user role has permission to create group in parent group
      const userRole = await GroupMembership.getInstance().findOne({
        group: parentGroup,
        user: user._id,
        roles: { $in: parentGroupRoles },
      });
      if (isNil(userRole)) {
        throw new GrpcError(
          status.PERMISSION_DENIED,
          'User does not have permission to create group in parent group',
        );
      }
    }
    const group = await Group.getInstance().create({
      name,
      parentGroup,
      isDefault,
      isRealm,
    });
    const role = await Role.getInstance().create({
      group: group._id,
      name: 'Admin',
      permissions: {
        canInvite: true,
        canRemove: true,
        canEditRoles: true,
        canDeleteGroup: true,
        canCreateGroup: true,
      },
    });
    await GroupMembership.getInstance().create({
      group: group._id,
      user: user._id,
      roles: [role._id],
    });
    return group;
  }

  async editGroup(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { groupId, name, parentGroup, isDefault, isRealm } = call.request.params;
    if (!isNil(parentGroup)) {
      const parentGroupCheck = await Group.getInstance().findOne({
        _id: parentGroup,
      });
      if (isNil(parentGroupCheck)) {
        throw new GrpcError(status.NOT_FOUND, 'Parent group not found');
      }
      // find role with permission to create group in parent group
      const parentGroupRoles = await Role.getInstance().findMany({
        group: parentGroup,
        permissions: {
          canCreateGroup: true,
          canDeleteGroup: true,
        },
      });
      if (isNil(parentGroupRoles) || parentGroupRoles.length === 0) {
        throw new GrpcError(
          status.PERMISSION_DENIED,
          'User does not have permission to edit group in parent group',
        );
      }
      // check if user role has permission to create group in parent group
      const userRole = await GroupMembership.getInstance().findOne({
        group: parentGroup,
        user: user._id,
        roles: { $in: parentGroupRoles },
      });
      if (isNil(userRole)) {
        throw new GrpcError(
          status.PERMISSION_DENIED,
          'User does not have permission to edit group in parent group',
        );
      }
    }

    const currentGroupCheck = await Group.getInstance().findOne({
      _id: groupId,
    });
    if (isNil(currentGroupCheck)) {
      throw new GrpcError(status.NOT_FOUND, 'Group not found');
    }
    // find role with permission to create group in parent group
    const currentGroupRoles = await Role.getInstance().findMany({
      group: currentGroupCheck._id,
      permissions: {
        canCreateGroup: true,
        canDeleteGroup: true,
      },
    });
    if (isNil(currentGroupRoles) || currentGroupRoles.length === 0) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'User does not have permission to edit group',
      );
    }
    // check if user role has permission to create group in parent group
    const userRole = await GroupMembership.getInstance().findOne({
      group: parentGroup,
      user: user._id,
      roles: { $in: currentGroupRoles },
    });
    if (isNil(userRole)) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'User does not have permission to edit group',
      );
    }

    const query: {
      name?: string;
      parentGroup?: string;
      isDefault?: boolean;
      isRealm?: boolean;
    } = {};
    if (!isNil(name)) {
      query.name = name;
    }
    if (!isNil(parentGroup)) {
      query.parentGroup = parentGroup;
    }
    if (!isNil(isDefault)) {
      query.isDefault = isDefault;
    }
    if (!isNil(isRealm)) {
      query.isRealm = isRealm;
    }
    let group = await Group.getInstance().findByIdAndUpdate(groupId, query, true);
    return group!;
  }

  async deleteRole(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { groupId, roleId } = call.request.params;
    const currentGroupCheck = await Group.getInstance().findOne({
      _id: groupId,
    });
    if (isNil(currentGroupCheck)) {
      throw new GrpcError(status.NOT_FOUND, 'Group not found');
    }
    // find role with permission to delete role in group
    const currentGroupRoles = await Role.getInstance().findMany({
      group: currentGroupCheck._id,
      permissions: {
        canDeleteRole: true,
      },
    });
    if (isNil(currentGroupRoles) || currentGroupRoles.length === 0) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'User does not have permission to delete role in group',
      );
    }
    // check if user role has permission to delete role in group
    const userRole = await GroupMembership.getInstance().findOne({
      group: groupId,
      user: user._id,
      roles: { $in: currentGroupRoles },
    });
    if (isNil(userRole)) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'User does not have permission to delete role in group',
      );
    }
    const roleCheck = await Role.getInstance().findOne({
      _id: roleId,
    });
    if (isNil(roleCheck)) {
      throw new GrpcError(status.NOT_FOUND, 'Role not found');
    }
    await Role.getInstance().deleteOne({ _id: roleId });
    return 'Role deleted!';
  }

  async createRole(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { groupId, name, permissions } = call.request.params;
    const currentGroupCheck = await Group.getInstance().findOne({
      _id: groupId,
    });
    if (isNil(currentGroupCheck)) {
      throw new GrpcError(status.NOT_FOUND, 'Group not found');
    }
    // find role with permission to create role in group
    const currentGroupRoles = await Role.getInstance().findMany({
      group: currentGroupCheck._id,
      permissions: {
        canCreateRole: true,
      },
    });
    if (isNil(currentGroupRoles) || currentGroupRoles.length === 0) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'User does not have permission to create role in group',
      );
    }
    // check if user role has permission to create role in group
    const userRole = await GroupMembership.getInstance().findOne({
      group: groupId,
      user: user._id,
      roles: { $in: currentGroupRoles },
    });
    if (isNil(userRole)) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'User does not have permission to create role in group',
      );
    }
    const role = await Role.getInstance().create({
      name,
      group: groupId,
      permissions,
    });
    // assign role to user
    await GroupMembership.getInstance().findByIdAndUpdate(userRole._id, {
      roles: [...userRole.roles, role._id],
    });
    return role!;
  }

  declareRoutes(routingManager: RoutingManager, config: Config): void {
    routingManager.route(
      {
        path: '/user/groups',
        description: `Returns the authenticated user's groups.`,
        action: ConduitRouteActions.GET,
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('GroupMemberships', {
        groupMemberships: ['GroupMembership'],
      }),
      this.getGroups.bind(this),
    );
    routingManager.route(
      {
        path: '/user/groups',
        bodyParams: {
          name: ConduitString.Required,
          parentGroup: ConduitObjectId.Optional,
          isDefault: ConduitBoolean.Optional,
          isRealm: ConduitBoolean.Optional,
        },
        description: `Creates a new group`,
        action: ConduitRouteActions.POST,
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('Group', Group.getInstance().fields),
      this.createGroup.bind(this),
    );
    routingManager.route(
      {
        path: '/user/groups/invitations',
        description: `Get current user's invitations to join a group.`,
        action: ConduitRouteActions.GET,
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('UserInvitations', {
        invites: [Token.getInstance().fields],
      }),
      this.userInvites.bind(this),
    );
    routingManager.route(
      {
        path: '/user/groups/invitations/:inviteId/:action',
        urlParams: {
          inviteId: ConduitObjectId.Required,
          action: ConduitBoolean.Required,
        },
        description: `Accepts or declines an invitation to join a group.`,
        action: ConduitRouteActions.POST,
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('InviteResponse', {
        message: ConduitString.Optional,
        groupMembership: { type: GroupMembership.getInstance().fields, required: false },
      }),
      this.inviteResponse.bind(this),
    );
    routingManager.route(
      {
        path: '/user/groups/:groupId',
        urlParams: {
          groupId: ConduitObjectId.Required,
        },
        description: `Get current user's role in specific group.`,
        action: ConduitRouteActions.GET,
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition(
        'GroupMembership',
        GroupMembership.getInstance().fields,
      ),
      this.getGroupRole.bind(this),
    );

    routingManager.route(
      {
        path: '/user/groups/:groupId',
        action: ConduitRouteActions.POST,
        urlParams: {
          groupId: ConduitObjectId.Required,
        },
        description: `Invites a user to join a group.`,
        bodyParams: {
          inviteeId: ConduitObjectId.Required,
          inviteeRole: ConduitObjectId.Required,
        },
      },
      new ConduitRouteReturnDefinition('UserGroupInviteResponse', 'String'),
      this.inviteToGroup.bind(this),
    );
    routingManager.route(
      {
        path: '/user/groups/:groupId/roles',
        urlParams: {
          groupId: ConduitObjectId.Required,
        },
        bodyParams: {
          name: ConduitString.Required,
          permissions: {
            canInvite: ConduitBoolean.Optional,
            canEditRoles: ConduitBoolean.Optional,
            canRemove: ConduitBoolean.Optional,
            canDeleteGroup: ConduitBoolean.Optional,
            canCreateGroup: ConduitBoolean.Optional,
          },
        },
        description: `Creates a new role in a group.`,
        action: ConduitRouteActions.POST,
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('Role', Role.getInstance().fields),
      this.createRole.bind(this),
    );

    routingManager.route(
      {
        path: '/user/groups/:groupId/roles/:roleId',
        urlParams: {
          groupId: ConduitObjectId.Required,
          roleId: ConduitObjectId.Required,
        },
        description: `Deletes a role from a group.`,
        action: ConduitRouteActions.DELETE,
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('DeleteRoleResponse', 'String'),
      this.deleteRole.bind(this),
    );

    routingManager.route(
      {
        path: '/user/groups/:groupId/:userId',
        urlParams: {
          groupId: ConduitObjectId.Required,
          userId: ConduitObjectId.Required,
        },
        description: `Removes a user from a group.`,
        action: ConduitRouteActions.DELETE,
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('RemoveFromGroupResponse', 'String'),
      this.removeFromGroup.bind(this),
    );

    routingManager.route(
      {
        path: '/user/groups/:groupId/:userId',
        urlParams: {
          groupId: ConduitObjectId.Required,
          userId: ConduitObjectId.Required,
        },
        bodyParams: {
          roles: [ConduitObjectId.Required],
        },
        description: `Modify a user's role in a group.`,
        action: ConduitRouteActions.PATCH,
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('ModifyUserRolesResponse', 'String'),
      this.modifyUserRole.bind(this),
    );

    routingManager.route(
      {
        path: '/user/groups/:groupId',
        urlParams: {
          groupId: ConduitObjectId.Required,
        },
        bodyParams: {
          name: ConduitString.Optional,
          parentGroup: ConduitObjectId.Optional,
          isDefault: ConduitBoolean.Optional,
          isRealm: ConduitBoolean.Optional,
        },
        description: `Edit a group's properties`,
        action: ConduitRouteActions.PATCH,
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('Group', Group.getInstance().fields),
      this.editGroup.bind(this),
    );
  }

  validate(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
