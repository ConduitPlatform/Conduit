import { ConduitModule } from '../../classes/ConduitModule';
import { GrpcServer } from '../../classes';
import { RouterDefinition, SocketData } from '../../protoUtils/core';
import { wrapRouterGrpcFunction } from '../../helpers';
import { constructProtoFile } from '../../helpers/RoutingUtilities';


export class Router extends ConduitModule<typeof RouterDefinition> {
  constructor(private readonly moduleName: string, url: string) {
    super(moduleName, url);
    this.initializeClient(RouterDefinition);
  }


  sleep(ms: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * @Deprecated
   */
  async registerRouter(
    server: GrpcServer,
    paths: any[],
    functions: { [name: string]: Function },
  ): Promise<any> {

    let protoDescriptions = constructProtoFile(this.moduleName, paths);
    await server.addService(
      protoDescriptions.path, protoDescriptions.name + '.router.Router',
      functions,
    );
    // fs.unlinkSync(protoPath);

    //added sleep as a precaution
    // With this register process there is the chance that the config instances will
    // not have the url of the service yet. In order to avoid this i've added the sleep period.
    // One case is to register to config module X and the admin package to request the url from
    // config module Y that hasn't been informed yet. It may be a rare case but this will help defend against it
    return this.sleep(3000).then(() => this.register(paths, protoDescriptions.file));
  }

  /**
   * @Deprecated
   */
  async registerRouterAsync(
    server: GrpcServer,
    paths: any[],
    functions: { [name: string]: (call: any, callback?: any) => Promise<any> },
  ): Promise<any> {
    let modifiedFunctions: { [name: string]: Function } = {};
    Object.keys(functions).forEach((key) => {
      modifiedFunctions[key] = wrapRouterGrpcFunction(functions[key]);
    });
    return this.registerRouter(server, paths, modifiedFunctions);
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
