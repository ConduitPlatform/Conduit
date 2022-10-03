import ConduitGrpcSdk, {
  ConduitNumber,
  ConduitRouteActions,
  ConduitRouteObject,
  ConduitRouteReturnDefinition,
  ConduitString,
  constructConduitRoute,
  ParsedRouterRequest,
  Query,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { ResourceDefinition } from '../models';
import { isNil } from 'lodash';
import escapeStringRegexp from 'escape-string-regexp';
import { ResourceController } from '../controllers/resource.controller';

export class ResourceHandler {
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  getRoutes(): ConduitRouteObject[] {
    return [
      constructConduitRoute(
        {
          path: '/resources',
          action: ConduitRouteActions.POST,
          description: `Creates a resource.`,
          bodyParams: {
            name: ConduitString.Required,
            relations: ConduitString.Required,
            permissions: ConduitString.Required,
          },
        },
        new ConduitRouteReturnDefinition(
          'CreateResource',
          ResourceDefinition.getInstance().fields,
        ),
        'createResource',
      ),
      constructConduitRoute(
        {
          path: '/resources',
          action: ConduitRouteActions.GET,
          description: `Returns queried resources.`,
          queryParams: {
            search: ConduitString.Optional,
            skip: ConduitNumber.Optional,
            limit: ConduitNumber.Optional,
            sort: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition('GetResources', {
          resources: [ResourceDefinition.getInstance().fields],
          count: ConduitNumber.Required,
        }),
        'getResources',
      ),
      constructConduitRoute(
        {
          path: '/resources/:name',
          action: ConduitRouteActions.GET,
          description: `Returns a resource.`,
          urlParams: {
            name: ConduitString.Required,
          },
        },
        new ConduitRouteReturnDefinition(
          'GetResource',
          ResourceDefinition.getInstance().fields,
        ),
        'getResource',
      ),
      constructConduitRoute(
        {
          path: '/resources/:name',
          action: ConduitRouteActions.PATCH,
          description: `Updates a resource.`,
          urlParams: {
            name: ConduitString.Required,
          },
          bodyParams: {
            relations: ConduitString.Optional,
            permissions: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition(
          'PatchResource',
          ResourceDefinition.getInstance().fields,
        ),
        'patchResource',
      ),
      constructConduitRoute(
        {
          path: '/resources/:name',
          action: ConduitRouteActions.DELETE,
          description: `Deletes a resource.`,
          urlParams: {
            name: ConduitString.Required,
          },
        },
        new ConduitRouteReturnDefinition('DeleteResource'),
        'deleteResource',
      ),
    ];
  }

  async createResource(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { name, relations, permissions } = call.request.params;
    const resource = await ResourceController.getInstance().createResource({
      name,
      relations,
      permissions,
    });
    this.grpcSdk.bus?.publish('authentication:create:resource', JSON.stringify(resource));
    return { resource };
  }

  async getResources(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { search, sort } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    let query: Query = {};
    if (!isNil(search)) {
      if (search.match(/^[a-fA-F0-9]{24}$/)) {
        query = { _id: search };
      } else {
        const nameSearch = escapeStringRegexp(search);
        query['name'] = { $regex: `.*${nameSearch}.*`, $options: 'i' };
      }
    }
    const resources = await ResourceDefinition.getInstance().findMany(
      query,
      undefined,
      skip,
      limit,
      sort,
    );
    const count = ResourceDefinition.getInstance().countDocuments(query);
    return { resources, count };
  }

  async getResource(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { name } = call.request.params;
    return ResourceController.getInstance().findResourceDefinition(name);
  }

  async patchResource(call: ParsedRouterRequest): Promise<UnparsedRouterResponse | null> {
    const { name, relations, permissions } = call.request.params;
    const resource = await ResourceController.getInstance().updateResourceDefinition(
      name,
      { relations, permissions },
    );
    this.grpcSdk.bus?.publish('authentication:update:resource', JSON.stringify(resource));
    return { resource };
  }

  async deleteResource(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { name } = call.request.params;
    return ResourceController.getInstance().deleteResource(name);
  }
}
