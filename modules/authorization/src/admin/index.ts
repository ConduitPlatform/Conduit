import ConduitGrpcSdk, {
  GrpcServer,
  ConduitRouteObject,
} from '@conduitplatform/grpc-sdk';
// import { RoleAdmin } from './roles';
import { ResourceHandler } from './resources';
import { RelationHandler } from './relations';

export class AdminHandlers {
  // private readonly roleAdmin: RoleAdmin;
  private readonly ResourceHandler: ResourceHandler;
  private readonly RelationHandler: RelationHandler;

  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
  ) {
    // this.roleAdmin = new RoleAdmin(this.grpcSdk);
    this.ResourceHandler = new ResourceHandler(this.grpcSdk);
    this.RelationHandler = new RelationHandler(this.grpcSdk);
    this.registerAdminRoutes();
  }

  private registerAdminRoutes() {
    const paths = this.getRegisteredRoutes();
    this.grpcSdk.admin
      .registerAdminAsync(this.server, paths, {
        // getRoles: this.roleAdmin.getRoles.bind(this),
        // deleteRole: this.roleAdmin.deleteRole.bind(this),
        // createRole: this.roleAdmin.createRole.bind(this),
        // patchRole: this.roleAdmin.patchRole.bind(this),
        createResource: this.ResourceHandler.createResource.bind(this),
        getResources: this.ResourceHandler.getResources.bind(this),
        getResource: this.ResourceHandler.getResource.bind(this),
        patchResource: this.ResourceHandler.patchResource.bind(this),
        deleteResource: this.ResourceHandler.deleteResource.bind(this),
        createRelation: this.RelationHandler.createRelation.bind(this),
        getRelation: this.RelationHandler.getRelation.bind(this),
        getRelations: this.RelationHandler.getRelations.bind(this),
        deleteRelation: this.RelationHandler.deleteRelation.bind(this),
      })
      .catch((err: Error) => {
        ConduitGrpcSdk.Logger.log('Failed to register admin routes for module!');
        ConduitGrpcSdk.Logger.error(err);
      });
  }

  private getRegisteredRoutes(): ConduitRouteObject[] {
    // return [...this.roleAdmin.getRoutes()];
    return [...this.RelationHandler.getRoutes(), ...this.ResourceHandler.getRoutes()];
  }

  reconstructIndices() {
    // used to trigger an index re-construction
  }
}
