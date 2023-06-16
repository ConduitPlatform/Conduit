import { ConduitModule } from '../../classes';
import {
  AllowedResourcesRequest,
  AllowedResourcesResponse,
  AuthorizationDefinition,
  Decision,
  DeleteAllRelationsRequest,
  FindRelationRequest,
  FindRelationResponse,
  PermissionCheck,
  PermissionRequest,
  Relation,
  Resource,
  ResourceAccessListRequest,
} from '../../protoUtils';
import { Empty } from '../../protoUtils/google/protobuf/empty';

export class Authorization extends ConduitModule<typeof AuthorizationDefinition> {
  constructor(private readonly moduleName: string, url: string, grpcToken?: string) {
    super(moduleName, 'authorization', url, grpcToken);
    this.initializeClient(AuthorizationDefinition);
  }

  defineResource(data: Resource): Promise<Empty> {
    return this.client!.defineResource(data);
  }

  updateResource(data: Resource): Promise<Empty> {
    return this.client!.updateResource(data);
  }

  deleteResource(data: Resource): Promise<Empty> {
    return this.client!.deleteResource(data);
  }

  deleteRelation(data: Relation): Promise<Empty> {
    return this.client!.deleteRelation(data);
  }

  deleteAllRelations(data: DeleteAllRelationsRequest): Promise<Empty> {
    return this.client!.deleteAllRelations(data);
  }

  createRelation(data: Relation): Promise<Empty> {
    return this.client!.createRelation(data);
  }

  findRelation(data: FindRelationRequest): Promise<FindRelationResponse> {
    return this.client!.findRelation(data);
  }

  can(data: PermissionCheck): Promise<Decision> {
    return this.client!.can(data);
  }

  grantPermission(data: PermissionRequest): Promise<Empty> {
    return this.client!.grantPermission(data);
  }

  removePermission(data: PermissionRequest): Promise<Empty> {
    return this.client!.removePermission(data);
  }

  getAllowedResources(data: AllowedResourcesRequest): Promise<AllowedResourcesResponse> {
    return this.client!.getAllowedResources(data);
  }

  createResourceAccessList(data: ResourceAccessListRequest): Promise<Empty> {
    return this.client!.createResourceAccessList(data);
  }
}
