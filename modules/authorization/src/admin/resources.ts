import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ParsedRouterRequest,
  Query,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitJson,
  ConduitNumber,
  ConduitString,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { ResourceDefinition } from '../models/index.js';
import { isNil } from 'lodash-es';
import escapeStringRegexp from 'escape-string-regexp';
import { ResourceController } from '../controllers/index.js';

export class ResourceHandler {
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  registerRoutes(routingManager: RoutingManager) {
    routingManager.route(
      {
        path: '/resources',
        action: ConduitRouteActions.POST,
        description: `Creates a resource.`,
        bodyParams: {
          name: ConduitString.Required,
          relations: ConduitJson.Required,
          permissions: ConduitJson.Required,
          version: ConduitNumber.Optional,
        },
      },
      new ConduitRouteReturnDefinition('CreateResource', {
        status: ConduitString.Required,
        resourceDefinition: ResourceDefinition.name,
      }),
      this.createResource.bind(this),
    );
    routingManager.route(
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
        resources: [ResourceDefinition.name],
        count: ConduitNumber.Required,
      }),
      this.getResources.bind(this),
    );
    routingManager.route(
      {
        path: '/resources/:id',
        action: ConduitRouteActions.GET,
        description: `Returns a resource.`,
        urlParams: {
          id: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition('Resource', ResourceDefinition.name),
      this.getResource.bind(this),
    );
    routingManager.route(
      {
        path: '/resources/:id',
        action: ConduitRouteActions.PATCH,
        description: `Updates a resource.`,
        urlParams: {
          id: ConduitString.Required,
        },
        bodyParams: {
          relations: ConduitJson.Required,
          permissions: ConduitJson.Required,
          version: ConduitNumber.Optional,
        },
      },
      new ConduitRouteReturnDefinition('PatchResource', {
        status: ConduitString.Required,
        resourceDefinition: ResourceDefinition.name,
      }),
      this.patchResource.bind(this),
    );
    routingManager.route(
      {
        path: '/resources/:id',
        action: ConduitRouteActions.DELETE,
        description: `Deletes a resource.`,
        urlParams: {
          id: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition('DeleteResource', 'String'),
      this.deleteResource.bind(this),
    );
  }

  async createResource(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { name, relations, permissions, version } = call.request.params;
    if (
      typeof relations !== 'object' ||
      Array.isArray(relations) ||
      typeof permissions !== 'object' ||
      Array.isArray(permissions)
    ) {
      throw new Error('Relations and permissions must be objects');
    }
    return ResourceController.getInstance().createResource({
      name,
      relations,
      permissions,
      version,
    });
  }

  async getResources(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { search, sort } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    let query: Query<ResourceDefinition> = {};
    if (!isNil(search)) {
      if (search.match(/^[a-fA-F0-9]{24}$/)) {
        query = { _id: search };
      } else {
        const nameSearch = escapeStringRegexp(search);
        query = { name: { $regex: `.*${nameSearch}.*`, $options: 'i' } };
      }
    }
    const resources = await ResourceDefinition.getInstance().findMany(
      query,
      undefined,
      skip,
      limit,
      sort,
    );
    if (isNil(resources)) {
      throw new Error('Resources not found');
    }
    resources.filter(r => isNil(r.version)).forEach(r => (r.version = 0));
    const count = await ResourceDefinition.getInstance().countDocuments(query);
    return { resources, count };
  }

  async getResource(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id } = call.request.params;
    return ResourceController.getInstance().findResourceDefinitionById(id);
  }

  async patchResource(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, relations, permissions, version } = call.request.params;
    if (
      typeof relations !== 'object' ||
      Array.isArray(relations) ||
      typeof permissions !== 'object' ||
      Array.isArray(permissions)
    ) {
      throw new Error('Relations and permissions must be objects');
    }
    return ResourceController.getInstance().updateResourceDefinition(
      { _id: id },
      { relations, permissions, version },
    );
  }

  async deleteResource(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id } = call.request.params;
    const found = ResourceDefinition.getInstance().findOne({ _id: id });
    if (isNil(found)) {
      throw new Error('Resource does not exist');
    }
    await ResourceDefinition.getInstance().deleteOne({ _id: id });
    return 'Resource deleted successfully';
  }
}
