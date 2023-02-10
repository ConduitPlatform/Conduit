import { ConduitModule } from '../../classes/ConduitModule';
import {
  AdminDefinition,
  GenerateProtoRequest,
  RegisterAdminRouteRequest,
  RegisterAdminRouteRequest_PathDefinition,
} from '../../protoUtils/core';
import {
  ConduitRouteActions,
  ConduitRouteObject,
  MiddlewarePatch,
  SocketProtoDescription,
} from '../../routing';

export class Admin extends ConduitModule<typeof AdminDefinition> {
  constructor(readonly moduleName: string, url: string, grpcToken?: string) {
    super(moduleName, 'admin', url, grpcToken);
    this.initializeClient(AdminDefinition);
  }

  generateProtoFile(
    moduleName: string,
    routes: (ConduitRouteObject | SocketProtoDescription)[],
  ) {
    const request: GenerateProtoRequest = {
      moduleName,
      routes: routes.map(r => JSON.stringify(r)),
    };
    return this.client!.generateProto(request);
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
