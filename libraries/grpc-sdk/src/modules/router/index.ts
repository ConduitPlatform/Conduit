import { ConduitModule } from '../../classes/ConduitModule';
import {
  GenerateProtoRequest,
  RegisterConduitRouteRequest,
  RegisterConduitRouteRequest_PathDefinition,
  RouterDefinition,
  SocketData,
} from '../../protoUtils/router';
import { ConduitRouteObject, SocketProtoDescription } from '../../routing';

export class Router extends ConduitModule<typeof RouterDefinition> {
  constructor(readonly moduleName: string, url: string, grpcToken?: string) {
    super(moduleName, 'router', url, grpcToken);
    this.initializeClients(RouterDefinition);
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
    paths: RegisterConduitRouteRequest_PathDefinition[],
    protoFile: string,
    url?: string,
  ): Promise<any> {
    const request: RegisterConduitRouteRequest = {
      routes: paths,
      protoFile: protoFile,
      routerUrl: url,
    };
    return this.serviceClient!.registerConduitRoute(request);
  }

  socketPush(data: SocketData) {
    return this.serviceClient!.socketPush(data);
  }
}
