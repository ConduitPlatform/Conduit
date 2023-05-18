import { ConduitModule } from '../../classes';
import {
  RegisterConduitRouteRequest,
  RegisterConduitRouteRequest_PathDefinition,
  RouterDefinition,
  SocketData,
} from '../../protoUtils/router';
import { ConduitRouteActions } from '../../interfaces';

export class Router extends ConduitModule<typeof RouterDefinition> {
  constructor(readonly moduleName: string, url: string, grpcToken?: string) {
    super(moduleName, 'router', url, grpcToken);
    this.initializeClient(RouterDefinition);
  }

  register(
    paths: RegisterConduitRouteRequest_PathDefinition[],
    url?: string,
  ): Promise<any> {
    const request: RegisterConduitRouteRequest = {
      routes: paths,
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
