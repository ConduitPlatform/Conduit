import { ConduitModule } from '../../classes/index.js';
import {
  AdminDefinition,
  RegisterAdminRouteRequest,
  RegisterAdminRouteRequest_PathDefinition,
} from '../../protoUtils/core.js';
import { ConduitRouteActions } from '../../interfaces/index.js';

export class Admin extends ConduitModule<typeof AdminDefinition> {
  constructor(
    readonly moduleName: string,
    url: string,
    grpcToken?: string,
  ) {
    super(moduleName, 'admin', url, grpcToken);
    this.initializeClient(AdminDefinition);
  }

  register(
    paths: RegisterAdminRouteRequest_PathDefinition[],
    serverUrl?: string,
  ): Promise<any> {
    const request: RegisterAdminRouteRequest = {
      routes: paths,
      routerUrl: serverUrl,
    };

    return this.client!.registerAdminRoute(request);
  }

  patchRouteMiddlewares(
    path: string,
    action: ConduitRouteActions,
    middlewares: string[],
  ) {
    return this.client!.patchRouteMiddlewares({
      path: path,
      action: action,
      middlewares: middlewares,
    });
  }
}
