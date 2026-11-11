import {
  ConduitGrpcSdk,
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
  ModuleError,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { errors } from '../errors.js';
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
        errors: [
          errors.RESOURCE_DEFINITION_MALFORMED,
          errors.RELATED_RESOURCE_NOT_FOUND,
          errors.INVALID_PERMISSION_ACTION,
          errors.INHERITED_PERMISSION_NOT_FOUND,
          errors.RESOURCE_VERSION_CONFLICT,
        ],
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
        errors: [errors.RESOURCE_DEFINITION_NOT_FOUND],
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
        errors: [
          errors.RESOURCE_DEFINITION_NOT_FOUND,
          errors.RESOURCE_DEFINITION_MALFORMED,
          errors.RELATED_RESOURCE_NOT_FOUND,
          errors.INVALID_PERMISSION_ACTION,
          errors.INHERITED_PERMISSION_NOT_FOUND,
          errors.RESOURCE_VERSION_CONFLICT,
        ],
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
        errors: [errors.RESOURCE_DEFINITION_NOT_FOUND],
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
      throw new ModuleError(errors.RESOURCE_DEFINITION_MALFORMED);
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
    const resources = await ResourceDefinition.getInstance().findMany(query, {
      skip,
      limit,
      sort,
    });
    if (isNil(resources)) {
      throw new ModuleError(errors.RESOURCE_DEFINITION_NOT_FOUND);
    }
    resources.filter(r => isNil(r.version)).forEach(r => (r.version = 0));
    const count = await ResourceDefinition.getInstance().countDocuments(query);
    return { resources, count };
  }

  async getResource(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id } = call.request.params;
    let resource: ResourceDefinition;
    if (id.match(/^[a-fA-F0-9]{24}$/)) {
      resource = await ResourceController.getInstance().findResourceDefinitionById(id);
    } else {
      resource = await ResourceController.getInstance().findResourceDefinition(id);
    }
    return resource;
  }

  async patchResource(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, relations, permissions, version } = call.request.params;
    if (
      typeof relations !== 'object' ||
      Array.isArray(relations) ||
      typeof permissions !== 'object' ||
      Array.isArray(permissions)
    ) {
      throw new ModuleError(errors.RESOURCE_DEFINITION_MALFORMED);
    }
    return ResourceController.getInstance().updateResourceDefinition(
      { _id: id },
      { relations, permissions, version },
    );
  }

  async deleteResource(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id } = call.request.params;
    const found = await ResourceDefinition.getInstance().findOne({ _id: id });
    if (isNil(found)) {
      throw new ModuleError(errors.RESOURCE_DEFINITION_NOT_FOUND);
    }
    await ResourceController.getInstance().deleteResource(found.name);
    return 'Resource deleted successfully';
  }
}
