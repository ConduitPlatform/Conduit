import ConduitGrpcSdk, {
  ConduitJson,
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
            relations: ConduitJson.Required,
            permissions: ConduitJson.Required,
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
          path: '/resources/:id',
          action: ConduitRouteActions.GET,
          description: `Returns a resource.`,
          urlParams: {
            id: ConduitString.Required,
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
          path: '/resources/:id',
          action: ConduitRouteActions.PATCH,
          description: `Updates a resource.`,
          urlParams: {
            id: ConduitString.Required,
          },
          bodyParams: {
            relations: ConduitJson.Optional,
            permissions: ConduitJson.Optional,
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
          path: '/resources/:id',
          action: ConduitRouteActions.DELETE,
          description: `Deletes a resource.`,
          urlParams: {
            id: ConduitString.Required,
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
    return resource;
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
    const found = await ResourceDefinition.getInstance().findMany(
      query,
      undefined,
      skip,
      limit,
      sort,
    );
    if (isNil(found)) {
      throw new Error('Resources not found');
    }
    const count = await ResourceDefinition.getInstance().countDocuments(query);
    return { found, count };
  }

  async getResource(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id } = call.request.params;
    return ResourceController.getInstance().findResourceDefinitionById(id);
  }

  async patchResource(call: ParsedRouterRequest): Promise<UnparsedRouterResponse | null> {
    const { id, relations, permissions } = call.request.params;
    const resource = await ResourceController.getInstance().updateResourceDefinitionById(
      id,
      { relations, permissions },
    );
    this.grpcSdk.bus?.publish('authentication:update:resource', JSON.stringify(resource));
    return resource;
  }

  async deleteResource(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id } = call.request.params;
    const found = ResourceDefinition.getInstance().findOne({ id });
    if (isNil(found)) {
      throw new Error('Resource does not exist');
    }
    await ResourceDefinition.getInstance().deleteOne({ id });
    return 'Resource deleted successfully';
  }
}
