import ConduitGrpcSdk, {
  ParsedRouterRequest,
  UnparsedRouterResponse,
  GrpcError,
  constructConduitRoute,
  ConduitRouteActions,
  ConduitNumber,
  ConduitString,
  ConduitRouteReturnDefinition,
  ConduitObjectId,
  ConduitRouteObject,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash';
import { Role } from '../models';
import escapeStringRegexp from 'escape-string-regexp';

export class RoleAdmin {
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  getRoutes(): ConduitRouteObject[] {
    return [
      constructConduitRoute(
        {
          path: '/roles',
          action: ConduitRouteActions.GET,
          queryParams: {
            skip: ConduitNumber.Optional,
            limit: ConduitNumber.Optional,
            sort: ConduitString.Optional,
            search: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition('GetRoles', {
          roles: [Role.getInstance().fields],
          count: ConduitNumber.Required,
        }),
        'getRoles',
      ),
      constructConduitRoute(
        {
          path: '/roles',
          action: ConduitRouteActions.POST,
          bodyParams: {
            name: { type: TYPE.String, required: true },
            group: { type: TYPE.ObjectId, required: false },
            isDefault: { type: TYPE.Boolean, required: false },
            permissions: {
              canInvite: {
                type: TYPE.Boolean,
                required: false,
              },
              canEditRoles: {
                type: TYPE.Boolean,
                required: false,
              },
              canRemove: {
                type: TYPE.Boolean,
                required: false,
              },
              canDeleteGroup: {
                type: TYPE.Boolean,
                required: false,
              },
              canCreateGroup: {
                type: TYPE.Boolean,
                required: false,
              },
            },
          },
        },
        new ConduitRouteReturnDefinition('CreateRole', Role.getInstance().fields),
        'createRole',
      ),
      constructConduitRoute(
        {
          path: '/roles/:id',
          action: ConduitRouteActions.DELETE,
          urlParams: {
            id: ConduitObjectId.Required,
          },
        },
        new ConduitRouteReturnDefinition('DeleteRole', 'String'),
        'deleteRole',
      ),
      constructConduitRoute(
        {
          path: '/roles/:id',
          action: ConduitRouteActions.PATCH,
          urlParams: {
            id: ConduitObjectId.Required,
          },
          bodyParams: Role.getInstance().fields,
        },
        new ConduitRouteReturnDefinition('PatchRole', Role.getInstance().fields),
        'pathRole',
      ),
    ];
  }

  async getRoles(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { search, sort, group } = call.request.params;
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
    if (!isNil(group)) {
      query['group'] = group;
    }

    const roles: any[] = await Role.getInstance().findMany(
      query,
      undefined,
      skip,
      limit,
      sort,
    );
    const count: number = await Role.getInstance().countDocuments(query);

    return { roles, count };
  }

  async createRole(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { name, group, isDefault, permissions } = call.request.params;

    let role: Role | null = await Role.getInstance().findOne({
      name,
      group,
    });
    if (!isNil(role)) {
      throw new GrpcError(status.ALREADY_EXISTS, 'Role already exists');
    }
    role = await Role.getInstance().create({
      name,
      group,
      isDefault,
      permissions,
    });
    this.grpcSdk.bus?.publish('authentication:create:role', JSON.stringify(role));
    return { role };
  }

  async patchRole(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, name, group, isDefault, permissions } = call.request.params;

    const role: Role | null = await Role.getInstance().findOne({
      _id: id,
    });
    if (isNil(role)) {
      throw new GrpcError(status.NOT_FOUND, 'Role does not exist');
    }
    const query = {
      name: name ?? role.name,
      group: group ?? role.group,
      isDefault: isDefault ?? role.isDefault,
      permissions: permissions ?? role.permissions,
    };
    const res: Role | null = await Role.getInstance().findByIdAndUpdate(id, query);
    this.grpcSdk.bus?.publish('authentication:update:role', JSON.stringify(res));
    return { res };
  }

  async deleteRole(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const role: Role | null = await Role.getInstance().findOne({
      _id: call.request.params.id,
    });
    if (isNil(role)) {
      throw new GrpcError(status.NOT_FOUND, 'Role does not exist');
    }
    const res = await Role.getInstance().deleteOne({ _id: call.request.params.id });
    this.grpcSdk.bus?.publish('authentication:delete:role', JSON.stringify(res));
    return 'Role was deleted';
  }
}
