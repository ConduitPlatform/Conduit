import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { Relationship, ResourceDefinition } from '../models';
import { IndexController } from './index.controller';
import { RelationsController } from './relations.controller';

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
  async createResource(resource: any) {
    const resourceDefinition = await ResourceDefinition.getInstance().findOne({
      name: resource.name,
    });
    if (resourceDefinition) {
      return await this.updateResourceDefinition(resource.name, resource);
    }
    await this.validateResourceRelations(resource.relations, resource.name);
    await this.validateResourcePermissions(resource);

    return await ResourceDefinition.getInstance().create(resource);
  }

  async validateResourceRelations(
    relations: { [key: string]: string[] },
    resourceName: string,
  ) {
    const relationResources = [];
    for (const relation of Object.keys(relations)) {
      for (const resource of relations[relation]) {
        if (resourceName === resource || relationResources.indexOf(resource) !== -1)
          continue;
        relationResources.push(resource);
      }
    }
    const found = await ResourceDefinition.getInstance().countDocuments({
      name: { $in: relationResources },
    });
    if (found !== relationResources.length)
      throw new Error('One or more related resources was not found');
  }

  async validateResourcePermissions(resource: any) {
    const perms = resource.permissions;
    for (const perm of Object.keys(perms)) {
      if (!Array.isArray(perms[perm])) {
        throw new Error('Permissions must be an array');
      }
      if (perm.indexOf('->') !== -1) {
        const found = await ResourceDefinition.getInstance().findMany({
          name: { $in: resource.relations[perm.split('->')[0]] },
          [`permissions${perm.split('->')[1]}`]: { $exists: true },
        });
        if (found.length === resource.relations[perm.split('->')[0]].length) continue;
        throw new Error(`Permission ${perm} not found in related resources`);
      }
    }
  }

  attributeCheck(attr: any) {
    return attr && Object.keys(attr).length !== 0;
  }

  async updateResourceDefinition(name: string, resource: any) {
    const resourceDefinition = await ResourceDefinition.getInstance().findOne({ name });
    if (!resourceDefinition) throw new Error('Resource not found');

    if (
      this.attributeCheck(resource.permissions) &&
      this.attributeCheck(resourceDefinition.permissions) &&
      resource.permissions !== resourceDefinition.permissions
    ) {
      await this.validateResourcePermissions(resource);
      await this.indexController.modifyPermission(resourceDefinition, resource);
    }
    if (
      this.attributeCheck(resource.relations) &&
      this.attributeCheck(resourceDefinition.relations) &&
      resource.relations !== resourceDefinition.relations
    ) {
      await this.validateResourceRelations(resource.relations, resource.name);
      await this.indexController.modifyRelations(resourceDefinition, resource);
    }
    delete resource._id;
    delete resource.name;
    return await ResourceDefinition.getInstance().findByIdAndUpdate(
      resourceDefinition._id,
      resource,
    );
  }

  async updateResourceDefinitionById(
    id: string,
    resource: any,
  ): Promise<ResourceDefinition> {
    const resourceDefinition = await ResourceDefinition.getInstance().findOne({
      _id: id,
    });
    if (!resourceDefinition) throw new Error('Resource not found');
    if (resource.permissions !== resourceDefinition.permissions) {
      await this.validateResourcePermissions(resource);
      await this.indexController.modifyPermission(resourceDefinition, resource);
    }
    if (resource.relations !== resourceDefinition.relations) {
      await this.validateResourceRelations(resource.relations, resource.name);
      await this.indexController.modifyRelations(resourceDefinition, resource);
    }
    delete resource._id;
    delete resource.name;
    return (await ResourceDefinition.getInstance().findByIdAndUpdate(
      resourceDefinition._id,
      resource,
    ))!;
  }

  async deleteResource(name: string) {
    const resourceDefinition = await ResourceDefinition.getInstance().findOne({ name });
    if (!resourceDefinition) throw new Error('Resource not found');
    await Relationship.getInstance().deleteMany({
      name: { $regex: `.*${resourceDefinition.name}.*`, $options: 'i' },
    });
    await this.relationsController.removeResource(name);
    await this.indexController.removeResource(name);
    return await ResourceDefinition.getInstance().deleteOne({ name });
  }

  async findResourceDefinition(name: string) {
    const resourceDefinition = await ResourceDefinition.getInstance().findOne({ name });
    if (!resourceDefinition) throw new Error('Resource not found');
    return resourceDefinition;
  }

  async findResourceDefinitionById(id: string) {
    const resourceDefinition = await ResourceDefinition.getInstance().findOne({
      _id: id,
    });
    if (!resourceDefinition) throw new Error('Resource not found');
    return resourceDefinition;
  }
}
