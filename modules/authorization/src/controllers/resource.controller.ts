import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { ResourceDefinition } from '../models/ResourceDefinition.schema';

export class ResourceController {
  private static _instance: ResourceController;

  private constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  getInstance(grpcSdk?: ConduitGrpcSdk) {
    if (ResourceController._instance) return ResourceController._instance;
    if (grpcSdk) {
      return (ResourceController._instance = new ResourceController(grpcSdk));
    }
    throw new Error('No grpcSdk instance provided!');
  }

  async createResource(resource: ResourceDefinition) {
    const resourceDefinition = await ResourceDefinition.getInstance().findOne({
      name: resource.name,
    });
    if (resourceDefinition) throw new Error('Resource already exists');
    return await ResourceDefinition.getInstance().create(resource);
  }

  //edit resource
  async updateResourceDefinition(name: string, resource: ResourceDefinition) {
    const resourceDefinition = await ResourceDefinition.getInstance().findOne({ name });
    if (!resourceDefinition) throw new Error('Resource not found');
    return await ResourceDefinition.getInstance().findByIdAndUpdate(
      resourceDefinition._id,
      resource,
    );
  }

  async deleteResource(name: string) {
    //todo should also trigger relation deletions
    const resourceDefinition = await ResourceDefinition.getInstance().findOne({ name });
    if (!resourceDefinition) throw new Error('Resource not found');
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
