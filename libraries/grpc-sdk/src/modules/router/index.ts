import { ConduitModule } from '../../classes';
import {
  GenerateProtoRequest,
  RegisterConduitRouteRequest,
  RegisterConduitRouteRequest_PathDefinition,
  RouterDefinition,
  SocketData,
} from '../../protoUtils/router';
import {
  ConduitProxyObject,
  ConduitRouteActions,
  ConduitRouteObject,
  SocketProtoDescription,
} from '../../interfaces';

export class Router extends ConduitModule<typeof RouterDefinition> {
  constructor(readonly moduleName: string, url: string, grpcToken?: string) {
    super(moduleName, 'router', url, grpcToken);
    this.initializeClient(RouterDefinition);
  }

  generateProtoFile(
    moduleName: string,
    routes: (ConduitRouteObject | SocketProtoDescription | ConduitProxyObject)[],
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

  socketPush(data: SocketData) {
    return this.client!.socketPush(data);
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
