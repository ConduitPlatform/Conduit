import { ConduitRoute, ConduitRouteActions, ConduitRouteReturnDefinition, ConduitSDK, TYPE } from '@conduit/sdk';
import File from '../models/File';
import { FileHandlers } from '../handlers/file';

export class FileRoutes {
  private fileHandlers: FileHandlers;

  constructor(
    private readonly sdk: ConduitSDK
  ) {
    this.fileHandlers = new FileHandlers(sdk);
    this.registerRoutes();
  }

  registerRoutes() {
    const router = this.sdk.getRouter();
    router.registerRoute(new ConduitRoute({
      bodyParams: {
        name: TYPE.String,
        mimeType: TYPE.String
      },
      action: ConduitRouteActions.POST,
      path: '/storage/file'
    }, new ConduitRouteReturnDefinition('File', 'String'),
      this.fileHandlers.createFile.bind(this.fileHandlers)));

    router.registerRoute(new ConduitRoute({
      queryParams: {
        id: TYPE.String
      },
      action: ConduitRouteActions.GET,
      path: '/storage/file' // TODO we need to change this to /storage/file/:id once path params work in the router
    }, new ConduitRouteReturnDefinition('File', 'String'),
      this.fileHandlers.getFile.bind(this.fileHandlers)));
  }

}
