import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { ResourceDefinition, Relationship } from '../models';
import { IndexController } from './index.controller';

export class ResourceController {
  private static _instance: ResourceController;

  private constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly indexController = IndexController.getInstance(grpcSdk),
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
    if (resourceDefinition) throw new Error('Resource already exists');
    await this.validateResourceRelations(resource.relations);
    await this.validateResourcePermissions(resource);

    return await ResourceDefinition.getInstance().create(resource);
  }

  async validateResourceRelations(relations: { [key: string]: string[] }) {
    let relationResources = [];
    for (let relation of Object.keys(relations)) {
      relationResources.push(...relations[relation]);
    }
    let found = await ResourceDefinition.getInstance().countDocuments({
      name: { $in: relationResources },
    });
    if (found !== relationResources.length)
      throw new Error('One or more related resources was not found');
  }

  async validateResourcePermissions(resource: any) {
    let perms = resource.permissions;
    for (let perm of Object.keys(perms)) {
      if (!Array.isArray(perms[perm])) {
        throw new Error('Permissions must be an array');
      }
      if (perm.indexOf('->') !== -1) {
        let found = await ResourceDefinition.getInstance().findMany({
          name: { $in: resource.relations[perm.split('->')[0]] },
          [`permissions${perm.split('->')[1]}`]: { $exists: true },
        });
        if (found.length === resource.relations[perm.split('->')[0]].length) continue;
        throw new Error(`Permission ${perm} not found in related resources`);
      }
    }
  }

  //edit resource
  //todo check permission and relation content
  async updateResourceDefinition(name: string, resource: ResourceDefinition) {
    const resourceDefinition = await ResourceDefinition.getInstance().findOne({ name });
    if (!resourceDefinition) throw new Error('Resource not found');
    if (resource.relations !== resourceDefinition.relations) {
      await this.validateResourceRelations(resource.relations);
      await this.indexController.modifyRelations(resourceDefinition, resource);
    }

    if (resource.permissions !== resourceDefinition.permissions) {
      await this.validateResourcePermissions(resource);
      await this.indexController.modifyPermission(resourceDefinition, resource);
    }
    // delete applicable indices and re-create valid ones
    return await ResourceDefinition.getInstance().findByIdAndUpdate(
      resourceDefinition._id,
      resource,
    );
  }

  async deleteResource(name: string) {
    //todo should also trigger relation deletions
    const resourceDefinition = await ResourceDefinition.getInstance().findOne({ name });
    if (!resourceDefinition) throw new Error('Resource not found');
    await Relationship.getInstance().deleteMany({
      name: { $regex: `.*${resourceDefinition.name}.*`, $options: 'i' },
    });
    // delete indices
    this.indexController.removeResource(name);
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
