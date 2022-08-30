import ConduitGrpcSdk, {
  ParsedRouterRequest,
  UnparsedRouterResponse,
  GrpcError,
  constructConduitRoute,
  ConduitRouteActions,
  ConduitNumber,
  ConduitString,
  ConduitRouteReturnDefinition,
  RouteOptionType,
  ConduitObjectId,
  ConduitRouteObject,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash';
import { Group, Role, User } from '../models';
import escapeStringRegexp from 'escape-string-regexp';
import { GroupMembership } from '../models/GroupMembership.schema';

export class GroupAdmin {
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  getRoutes(): ConduitRouteObject[] {
    return [
      constructConduitRoute(
        {
          path: '/groups',
          action: ConduitRouteActions.GET,
          queryParams: {
            skip: ConduitNumber.Optional,
            limit: ConduitNumber.Optional,
            sort: ConduitString.Optional,
            search: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition('GetGroups', {
          groups: [Group.getInstance().fields],
          count: ConduitNumber.Required,
        }),
        'getGroups',
      ),
      constructConduitRoute(
        {
          path: '/groups',
          action: ConduitRouteActions.POST,
          bodyParams: {
            name: { type: RouteOptionType.String, required: true },
            parentGroup: { type: RouteOptionType.ObjectId, required: false },
            isDefault: { type: RouteOptionType.Boolean, required: false },
            isRealm: { type: RouteOptionType.Boolean, required: false },
          },
        },
        new ConduitRouteReturnDefinition('CreateGroup', Group.getInstance().fields),
        'createGroup',
      ),
      constructConduitRoute(
        {
          path: '/groups/:id',
          action: ConduitRouteActions.DELETE,
          urlParams: {
            id: ConduitObjectId.Required,
          },
        },
        new ConduitRouteReturnDefinition('DeleteGroup', 'String'),
        'deleteGroup',
      ),
      constructConduitRoute(
        {
          path: '/groups/:id',
          action: ConduitRouteActions.PATCH,
          urlParams: {
            id: ConduitObjectId.Required,
          },
          bodyParams: Group.getInstance().fields,
        },
        new ConduitRouteReturnDefinition('PatchGroup', Group.getInstance().fields),
        'patchGroup',
      ),
      constructConduitRoute(
        {
          path: '/groups/:id/members',
          action: ConduitRouteActions.POST,
          urlParams: {
            id: ConduitObjectId.Required,
          },
          bodyParams: {
            userId: ConduitObjectId.Required,
            roles: [{ type: TYPE.Relation, model: 'Role', required: false }],
          },
        },
        new ConduitRouteReturnDefinition(
          'AddUserToGroup',
          GroupMembership.getInstance().fields,
        ),
        'addToGroup',
      ),
      constructConduitRoute(
        {
          path: '/groups/:id/members/:userId',
          action: ConduitRouteActions.DELETE,
          urlParams: {
            id: ConduitObjectId.Required,
            userId: ConduitObjectId.Required,
          },
        },
        new ConduitRouteReturnDefinition(
          'RemoveUserFromGroup',
          GroupMembership.getInstance().fields,
        ),
        'removeFromGroup',
      ),
      constructConduitRoute(
        {
          path: '/groups/:id/members/:userId',
          action: ConduitRouteActions.PATCH,
          urlParams: {
            id: ConduitObjectId.Required,
            userId: ConduitObjectId.Required,
          },
          bodyParams: {
            roles: [{ type: TYPE.Relation, model: 'Role', required: true }],
          },
        },
        new ConduitRouteReturnDefinition(
          'ModifyUserRole',
          GroupMembership.getInstance().fields,
        ),
        'modifyRole',
      ),
    ];
  }

  async getGroups(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { search, sort } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;

    let query: any = {};
    if (!isNil(search)) {
      if (search.match(/^[a-fA-F0-9]{24}$/)) {
        query = { _id: search };
      } else {
        const nameSearch = escapeStringRegexp(search);
        query['name'] = { $regex: `.*${nameSearch}.*`, $options: 'i' };
      }
    }

    const groups: Group[] = await Group.getInstance().findMany(
      query,
      undefined,
      skip,
      limit,
      sort,
    );
    const count: number = await Group.getInstance().countDocuments(query);

    return { groups, count };
  }

  async createGroup(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { name, parentGroup, isDefault, isRealm } = call.request.params;

    let group: Group | null = await Group.getInstance().findOne({
      name,
      parentGroup,
    });
    if (!isNil(group)) {
      throw new GrpcError(status.ALREADY_EXISTS, 'Group already exists');
    }

    if (isDefault) {
      group = await Group.getInstance().findOne({ isDefault: true });
      if (!isNil(group)) {
        throw new GrpcError(status.ALREADY_EXISTS, 'Default group already exists');
      }
    }

    group = await Group.getInstance().create({
      name,
      parentGroup,
      isDefault,
      isRealm,
    });
    this.grpcSdk.bus?.publish('authentication:create:group', JSON.stringify(group));
    return { group };
  }

  async patchGroup(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, name, parentGroup, isDefault, isRealm } = call.request.params;

    const group: Group | null = await Group.getInstance().findOne({
      _id: id,
    });
    if (isNil(group)) {
      throw new GrpcError(status.NOT_FOUND, 'Group does not exist');
    }
    const query = {
      name: name ?? group.name,
      parentGroup: parentGroup ?? group.parentGroup,
      isDefault: isDefault ?? group.isDefault,
      isRealm: isRealm ?? group.isRealm,
    };
    const res: Group | null = await Group.getInstance().findByIdAndUpdate(id, query);
    this.grpcSdk.bus?.publish('authentication:update:group', JSON.stringify(res));
    return { res };
  }

  async deleteGroup(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const group: Group | null = await Group.getInstance().findOne({
      _id: call.request.params.id,
    });
    if (isNil(group)) {
      throw new GrpcError(status.NOT_FOUND, 'Group does not exist');
    }
    const res = await Group.getInstance().deleteOne({ _id: call.request.params.id });
    this.grpcSdk.bus?.publish('authentication:delete:group', JSON.stringify(res));
    return 'Group was deleted';
  }

  async addToGroup(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { userId, id } = call.request.params;
    let roles: string[] | Role[] | null = call.request.params.roles;
    const user: User | null = await User.getInstance().findOne({ _id: userId });
    if (isNil(user)) {
      throw new GrpcError(status.NOT_FOUND, 'User does not exist');
    }

    let groupMemberships: GroupMembership | null =
      await GroupMembership.getInstance().findOne({
        user,
        group: id,
      });
    if (!isNil(groupMemberships)) {
      throw new GrpcError(status.NOT_FOUND, 'User already in group');
    } else {
      if (isNil(roles) || roles.length === 0) {
        let role = await Role.getInstance().findOne({ group: id, isDefault: true });
        if (isNil(role)) {
          throw new GrpcError(
            status.NOT_FOUND,
            'Role not provided and no default role found',
          );
        }
        roles = [role];
      }
      groupMemberships = await GroupMembership.getInstance().create({
        user,
        group: id,
        roles,
      });
    }
    this.grpcSdk.bus?.publish(
      'authentication:add:user:group',
      JSON.stringify(groupMemberships),
    );
    return { membership: groupMemberships };
  }

  async removeFromGroup(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, group } = call.request.params;
    const user: User | null = await User.getInstance().findOne({ _id: id });
    if (isNil(user)) {
      throw new GrpcError(status.NOT_FOUND, 'User does not exist');
    }
    let groupMemberships: GroupMembership | null =
      await GroupMembership.getInstance().findOne({
        user: id,
        group,
      });
    if (isNil(groupMemberships)) {
      throw new GrpcError(status.NOT_FOUND, 'User is not in group');
    } else {
      await GroupMembership.getInstance().deleteOne({
        user: id,
        group,
      });
    }
    this.grpcSdk.bus?.publish(
      'authentication:remove:user:group',
      JSON.stringify(groupMemberships),
    );
    return { membership: groupMemberships };
  }

  async modifyRole(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, group, roles } = call.request.params;
    const user: User | null = await User.getInstance().findOne({ _id: id });
    if (isNil(user)) {
      throw new GrpcError(status.NOT_FOUND, 'User does not exist');
    }

    let groupMemberships: GroupMembership | null =
      await GroupMembership.getInstance().findOne({
        user: id,
        group,
      });
    if (isNil(groupMemberships)) {
      throw new GrpcError(status.NOT_FOUND, 'User is not in group');
    } else {
      groupMemberships.roles = roles;
      await GroupMembership.getInstance().findByIdAndUpdate(
        groupMemberships._id,
        groupMemberships,
      );
    }
    this.grpcSdk.bus?.publish(
      'authentication:modify:user:role',
      JSON.stringify(groupMemberships),
    );
    return { membership: groupMemberships };
  }
}
