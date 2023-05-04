import { ConduitModule } from '../../classes';
import {
  AdminDefinition,
  GenerateAdminProtoRequest,
  RegisterAdminRouteRequest,
  RegisterAdminRouteRequest_PathDefinition,
} from '../../protoUtils';
import {
  ConduitProxyObject,
  ConduitRouteActions,
  ConduitRouteObject,
  SocketProtoDescription,
} from '../../interfaces';

export class Admin extends ConduitModule<typeof AdminDefinition> {
  constructor(readonly moduleName: string, url: string, grpcToken?: string) {
    super(moduleName, 'admin', url, grpcToken);
    this.initializeClient(AdminDefinition);
  }

  generateProtoFile(
    moduleName: string,
    routes: (ConduitRouteObject | SocketProtoDescription | ConduitProxyObject)[],
  ) {
    const request: GenerateAdminProtoRequest = {
      moduleName,
      routes: routes.map(r => JSON.stringify(r)),
    };
    return this.client!.generateAdminProto(request);
  }

  register(
    paths: RegisterAdminRouteRequest_PathDefinition[],
    protoFile: string,
    serverUrl?: string,
  ): Promise<any> {
    const request: RegisterAdminRouteRequest = {
      routes: paths,
      protoFile: protoFile,
      routerUrl: serverUrl,
    };

    return this.client!.registerAdminRoute(request);
  }

  patchMiddleware(path: string, action: ConduitRouteActions, middleware: string[]) {
    return this.client!.patchMiddleware({
      path: path,
      action: action,
      middleware: middleware,
    });
  }
}
