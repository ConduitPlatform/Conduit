import { ConduitModule } from '../../classes/ConduitModule';
import {
  AdminDefinition,
  GenerateProtoRequest,
  RegisterAdminRouteRequest,
  RegisterAdminRouteRequest_PathDefinition,
} from '../../protoUtils/core';
import { ConduitRouteObject, SocketProtoDescription } from '../../routing';

export class Admin extends ConduitModule<typeof AdminDefinition> {
  constructor(readonly moduleName: string, url: string, grpcToken?: string) {
    super(moduleName, 'admin', url, grpcToken);
    this.initializeClients(AdminDefinition);
  }

  generateProtoFile(
    moduleName: string,
    routes: (ConduitRouteObject | SocketProtoDescription)[],
  ) {
    const request: GenerateProtoRequest = {
      moduleName,
      routes: routes.map(r => JSON.stringify(r)),
    };
    return this.serviceClient!.generateProto(request);
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

    return this.serviceClient!.registerAdminRoute(request);
  }
}
