import { ConduitModule } from '../../classes/ConduitModule';
import {
  GenerateProtoRequest,
  RegisterConduitRouteRequest,
  RegisterConduitRouteRequest_PathDefinition,
  RegisterProxyRouteRequest,
  RegisterProxyRouteRequest_ProxyRouteDefinition,
  RouterDefinition,
  SocketData,
} from '../../protoUtils/router';
import { ConduitProxy, ConduitRouteObject, SocketProtoDescription } from '../../routing';

export class Router extends ConduitModule<typeof RouterDefinition> {
  constructor(readonly moduleName: string, url: string, grpcToken?: string) {
    super(moduleName, 'router', url, grpcToken);
    this.initializeClient(RouterDefinition);
  }

  generateProtoFile(
    moduleName: string,
    routes: (ConduitRouteObject | SocketProtoDescription | ConduitProxy)[],
  ) {
    const request: GenerateProtoRequest = {
      moduleName,
      routes: routes.map(r => JSON.stringify(r)),
    };
    return this.client!.generateProto(request);
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
    return this.client!.registerConduitRoute(request);
  }

  registerGrpcProxyRoute(
    paths: RegisterProxyRouteRequest_ProxyRouteDefinition[],
    protoFile: string,
    url?: string,
  ) {
    const request: RegisterProxyRouteRequest = {
      proxyRoutes: paths,
      protoFile: protoFile,
      routerUrl: url,
    };
    return this.client!.registerProxyRoute(request);
  }

  socketPush(data: SocketData) {
    return this.client!.socketPush(data);
  }
}
