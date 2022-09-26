import { ConduitModule } from '../../classes/ConduitModule';
import {
  AuthorizationDefinition,
  Decision,
  Empty,
  FindRelationRequest,
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

  updateResourceDefinition(data: Resource): Promise<Empty> {
    return this.client!.updateResourceDefinition(data);
  }

  createRelation(data: Relation): Promise<Empty> {
    return this.client!.createRelation(data);
  }

  findRelation(data: FindRelationRequest): Promise<Relation> {
    return this.client!.findRelation(data);
  }

  can(data: PermissionCheck): Promise<Decision> {
    return this.client!.can(data);
  }
}
