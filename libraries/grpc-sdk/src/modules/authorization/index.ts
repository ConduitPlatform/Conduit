import { ConduitModule } from '../../classes/ConduitModule';
import {
  AuthorizationDefinition,
  Decision,
  DeleteAllRelationsRequest,
  Empty,
  FindRelationRequest,
  FindRelationResponse,
  PermissionCheck,
  PermissionRequest,
  Relation,
  Resource,
} from '../../protoUtils/authorization';

export class Authorization extends ConduitModule<typeof AuthorizationDefinition> {
  constructor(private readonly moduleName: string, url: string, grpcToken?: string) {
    super(moduleName, 'authorization', url, grpcToken);
    this.initializeClients(AuthorizationDefinition);
  }

  defineResource(data: Resource): Promise<Empty> {
    return this.serviceClient!.defineResource(data);
  }

  updateResource(data: Resource): Promise<Empty> {
    return this.serviceClient!.updateResource(data);
  }

  deleteResource(data: Resource): Promise<Empty> {
    return this.serviceClient!.deleteResource(data);
  }

  deleteRelation(data: Relation): Promise<Empty> {
    return this.serviceClient!.deleteRelation(data);
  }

  deleteAllRelations(data: DeleteAllRelationsRequest): Promise<Empty> {
    return this.serviceClient!.deleteAllRelations(data);
  }

  createRelation(data: Relation): Promise<Empty> {
    return this.serviceClient!.createRelation(data);
  }

  findRelation(data: FindRelationRequest): Promise<FindRelationResponse> {
    return this.serviceClient!.findRelation(data);
  }

  can(data: PermissionCheck): Promise<Decision> {
    return this.serviceClient!.can(data);
  }

  grantPermission(data: PermissionRequest): Promise<Empty> {
    return this.serviceClient!.grantPermission(data);
  }

  removePermission(data: PermissionRequest): Promise<Empty> {
    return this.serviceClient!.removePermission(data);
  }
}
