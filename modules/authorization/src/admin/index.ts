import ConduitGrpcSdk, {
  GrpcServer,
  ConduitRouteObject,
} from '@conduitplatform/grpc-sdk';
import { RoleAdmin } from './roles';

export class AdminHandlers {
  private readonly roleAdmin: RoleAdmin;

  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
  ) {
    this.roleAdmin = new RoleAdmin(this.grpcSdk);
    this.registerAdminRoutes();
  }

  private registerAdminRoutes() {
    const paths = this.getRegisteredRoutes();
    this.grpcSdk.admin
      .registerAdminAsync(this.server, paths, {
        getRoles: this.roleAdmin.getRoles.bind(this),
        deleteRole: this.roleAdmin.deleteRole.bind(this),
        createRole: this.roleAdmin.createRole.bind(this),
        patchRole: this.roleAdmin.patchRole.bind(this),
      })
      .catch((err: Error) => {
        ConduitGrpcSdk.Logger.log('Failed to register admin routes for module!');
        ConduitGrpcSdk.Logger.error(err);
      });
  }

  private getRegisteredRoutes(): ConduitRouteObject[] {
    return [...this.roleAdmin.getRoutes()];
  }
}
