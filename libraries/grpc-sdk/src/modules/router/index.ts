import { ConduitModule } from '../../classes/ConduitModule';
import { RouterDefinition, SocketData } from '../../protoUtils/core';

export class Router extends ConduitModule<typeof RouterDefinition> {
  constructor(public readonly moduleName: string, url: string) {
    super(moduleName, url);
    this.initializeClient(RouterDefinition);
  }

  register(paths: any[], protoFile: string, url?: string): Promise<any> {
    let request = {
      routes: paths,
      protoFile: protoFile,
      routerUrl: url,
    };
    return this.client!.registerConduitRoute(request);
  }

  socketPush(data: SocketData) {
    return this.client!.socketPush(data);
  }
}
