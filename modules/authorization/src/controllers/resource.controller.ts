import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';
import { ResourceDefinition } from '../models/index.js';
import { assertPermissionAction } from '../utils/index.js';
import { RuleCache } from './cache.controller.js';
import { IndexController } from './index.controller.js';
import { RelationsController } from './relations.controller.js';
import { cloneDeep, isEqual, isNil } from 'lodash-es';

export class ResourceController {
  private static _instance: ResourceController;

  private constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly indexController = IndexController.getInstance(grpcSdk),
    private readonly relationsController = RelationsController.getInstance(grpcSdk),
  ) {}

  static getInstance(grpcSdk?: ConduitGrpcSdk) {
    if (ResourceController._instance) return ResourceController._instance;
    if (grpcSdk) {
      return (ResourceController._instance = new ResourceController(grpcSdk));
    }
    throw new Error('No grpcSdk instance provided!');
  }

  //todo check permission and relation content
  async createResource(
    resource: any,
  ): ReturnType<ResourceController['updateResourceDefinition']> {
    const resourceDefinition = await ResourceDefinition.getInstance().findOne({
      name: resource.name,
    });
    if (resourceDefinition) {
      return await this.updateResourceDefinition({ name: resource.name }, resource);
    }
    await this.validateResourceRelations(resource.relations, resource.name);
    await this.validateResourcePermissions(resource);
    await this.indexController.reIndexResource(resource.name);
    const res = await ResourceDefinition.getInstance().create({
      ...resource,
      version: resource.version ?? 0,
    });
    await RuleCache.invalidateGlobal(this.grpcSdk);
    this.grpcSdk.bus?.publish('authorization:create:resource', JSON.stringify(res));
    return { resourceDefinition: res, status: 'processed' };
  }

  async validateResourceRelations(
    relations: { [key: string]: string[] },
    resourceName: string,
  ) {
    const relationResources = [];
    let hasWildcard = false;
    for (const relation of Object.keys(relations)) {
      for (const resource of relations[relation]) {
        if (resource.indexOf('*') !== -1) hasWildcard = true;
        if (
          resourceName === resource ||
          relationResources.indexOf(resource) !== -1 ||
          resourceName === '*'
        )
          continue;
        relationResources.push(resource);
      }
    }
    const found = await ResourceDefinition.getInstance().countDocuments({
      name: { $in: relationResources },
    });
    if (hasWildcard) {
      if (found !== relationResources.length - 1)
        throw new ModuleError(errors.RELATED_RESOURCE_NOT_FOUND);
    } else if (found !== relationResources.length)
      throw new ModuleError(errors.RELATED_RESOURCE_NOT_FOUND);
  }

  excludeWildcard(relations: string[]) {
    const newRelations = [];
    for (const relation of relations) {
      if (relation.indexOf('*') === -1) {
        newRelations.push(relation);
      }
    }
    return newRelations;
  }

  async validateResourcePermissions(resource: any) {
    const perms = resource.permissions;
    const relations = resource.relations;
    for (const perm of Object.keys(perms)) {
      if (!perm.includes('->')) {
        assertPermissionAction(perm);
      }
      if (!Array.isArray(perms[perm])) {
        throw new ModuleError(errors.RESOURCE_DEFINITION_MALFORMED);
      }
      if (perm.indexOf('->') !== -1) {
        const relatedTypes = relations?.[perm.split('->')[0]];
        if (!Array.isArray(relatedTypes)) {
          throw new ModuleError(
            errors.INHERITED_PERMISSION_NOT_FOUND,
            `Permission ${perm} refers to an undeclared relation`,
          );
        }
        const found = await ResourceDefinition.getInstance().findMany({
          name: { $in: this.excludeWildcard(relatedTypes) },
          [`permissions.${perm.split('->')[1]}`]: { $exists: true },
        });
        if (found.length === this.excludeWildcard(relatedTypes).length) continue;
        throw new ModuleError(
          errors.INHERITED_PERMISSION_NOT_FOUND,
          `Permission ${perm} not found in related resources`,
        );
      }
    }
  }

  attributeCheck(attr: any) {
    return attr && Object.keys(attr).length !== 0;
  }

  async updateResourceDefinition(
    query: { _id: string } | { name: string },
    resource: any,
  ): Promise<{
    resourceDefinition: ResourceDefinition;
    status: 'processed' | 'acknowledged' | 'ignored';
  }> {
    const resourceDefinition = await ResourceDefinition.getInstance().findOne(query);
    if (!resourceDefinition) throw new ModuleError(errors.RESOURCE_DEFINITION_NOT_FOUND);

    if (isNil(resource.version) || resource.version < resourceDefinition.version) {
      return { resourceDefinition, status: 'ignored' };
    } else if (resource.version === resourceDefinition.version) {
      const dbResource: Partial<ResourceDefinition> = cloneDeep(resourceDefinition);
      delete dbResource._id;
      delete dbResource.createdAt;
      delete dbResource.updatedAt;
      delete (dbResource as any).__v;
      if (!isEqual(resource, dbResource)) {
        throw new ModuleError(errors.RESOURCE_VERSION_CONFLICT);
      }
      return { resourceDefinition, status: 'acknowledged' };
    }
    await this.validateResourcePermissions(resource);
    await this.validateResourceRelations(resource.relations, resource.name);
    await this.indexController.reIndexResource(resource.name);
    delete resource._id;
    delete resource.name;
    const res = (await ResourceDefinition.getInstance().findByIdAndUpdate(
      resourceDefinition._id,
      resource,
    ))!;
    await RuleCache.invalidateGlobal(this.grpcSdk);
    this.grpcSdk.bus?.publish('authorization:update:resource', JSON.stringify(res));
    return { resourceDefinition: res, status: 'processed' };
  }

  async deleteResource(name: string) {
    const resourceDefinition = await ResourceDefinition.getInstance().findOne({ name });
    if (!resourceDefinition) throw new ModuleError(errors.RESOURCE_DEFINITION_NOT_FOUND);
    await this.relationsController.removeResource(name);
    await this.indexController.removeResource(name);
    const deleted = await ResourceDefinition.getInstance().deleteOne({ name });
    await RuleCache.invalidateGlobal(this.grpcSdk);
    return deleted;
  }

  async findResourceDefinition(name: string) {
    const resourceDefinition = await ResourceDefinition.getInstance().findOne({ name });
    if (!resourceDefinition) throw new ModuleError(errors.RESOURCE_DEFINITION_NOT_FOUND);
    return resourceDefinition;
  }

  async findResourceDefinitionById(id: string) {
    const resourceDefinition = await ResourceDefinition.getInstance().findOne({
      _id: id,
    });
    if (!resourceDefinition) throw new ModuleError(errors.RESOURCE_DEFINITION_NOT_FOUND);
    return resourceDefinition;
  }
}
