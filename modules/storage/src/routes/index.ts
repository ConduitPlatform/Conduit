import { FileHandlers } from '../handlers/file';
import { File } from '../models';
import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcServer,
  RoutingManager,
  TYPE,
} from '@conduitplatform/grpc-sdk';

export class StorageRoutes {
  private _routingManager: RoutingManager;

  constructor(
    readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly fileHandlers: FileHandlers,
    private readonly enableAuthRoutes: boolean,
  ) {
    this._routingManager = new RoutingManager(this.grpcSdk.router!, server);
  }

  async registerRoutes() {
    this._routingManager.clear();

    this._routingManager.route(
      {
        urlParams: {
          id: { type: TYPE.String, required: true },
        },
        action: ConduitRouteActions.GET,
        path: '/storage/file/:id',
      },
      new ConduitRouteReturnDefinition('File'),
      this.fileHandlers.getFile.bind(this.fileHandlers),
    );

    this._routingManager.route(
      {
        urlParams: {
          id: { type: TYPE.String, required: true },
        },
        queryParams: {
          redirect: { type: TYPE.Boolean, required: false },
        },
        action: ConduitRouteActions.GET,
        path: '/storage/getFileUrl/:id',
      },
      new ConduitRouteReturnDefinition('FileUrl', 'String'),
      this.fileHandlers.getFileUrl.bind(this.fileHandlers),
    );

    if (this.enableAuthRoutes) {
      this._routingManager.route(
        {
          bodyParams: {
            name: { type: TYPE.String, required: true },
            mimeType: TYPE.String,
            data: { type: TYPE.String, required: true },
            folder: { type: TYPE.String, required: false },
            container: { type: TYPE.String, required: false },
            isPublic: TYPE.Boolean,
          },
          action: ConduitRouteActions.POST,
          path: '/storage/file',
          middlewares: ['authMiddleware'],
        },
        new ConduitRouteReturnDefinition('File'),
        this.fileHandlers.createFile.bind(this.fileHandlers),
      );

      this._routingManager.route(
        {
          urlParams: {
            id: { type: TYPE.String, required: true },
          },
          action: ConduitRouteActions.GET,
          middlewares: ['authMiddleware'],
          path: '/storage/file/data/:id',
        },
        new ConduitRouteReturnDefinition('File', {
          data: TYPE.String,
        }),
        this.fileHandlers.getFileData.bind(this.fileHandlers),
      );

      this._routingManager.route(
        {
          urlParams: {
            id: { type: TYPE.String, required: true },
          },
          action: ConduitRouteActions.DELETE,
          path: '/storage/file/:id',
          middlewares: ['authMiddleware'],
        },
        new ConduitRouteReturnDefinition('FileDeleteResponse', {
          success: TYPE.Boolean,
        }),
        this.fileHandlers.deleteFile.bind(this.fileHandlers),
      );

      this._routingManager.route(
        {
          urlParams: {
            id: { type: TYPE.String, required: true },
          },
          bodyParams: {
            name: TYPE.String,
            mimeType: TYPE.String,
            data: TYPE.String,
            folder: TYPE.String,
            container: TYPE.String,
          },
          action: ConduitRouteActions.PATCH,
          path: '/storage/file/:id',
          middlewares: ['authMiddleware'],
        },
        new ConduitRouteReturnDefinition('FileUpdateResponse', 'File'),
        this.fileHandlers.updateFile.bind(this.fileHandlers),
      );
    }

    await this._routingManager.registerRoutes();
  }
}
