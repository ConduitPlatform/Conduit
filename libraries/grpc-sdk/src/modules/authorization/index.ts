import { ConduitModule } from '../../classes/ConduitModule';
import {
  AuthorizationDefinition,
  Decision,
  DeleteAllRelationsRequest,
  Empty,
  FindRelationRequest,
  FindRelationResponse,
  PermissionCheck,
  Relation,
  Resource,
} from '../../protoUtils/authorization';

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
}
