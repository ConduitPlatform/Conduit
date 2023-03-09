import { FileHandlers } from '../handlers/file';
import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcServer,
  RoutingManager,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { File } from '../models';

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
        description: `Returns a file.`,
      },
      new ConduitRouteReturnDefinition(File.name),
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
        description: `Returns the file's url and optionally redirects to it.`,
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
          description: `Creates a new file.`,
          middlewares: ['authMiddleware'],
        },
        new ConduitRouteReturnDefinition('CreateFile', File.name),
        this.fileHandlers.createFile.bind(this.fileHandlers),
      );
      this._routingManager.route(
        {
          bodyParams: {
            name: { type: TYPE.String, required: true },
            mimeType: TYPE.String,
            folder: { type: TYPE.String, required: false },
            size: { type: TYPE.Number, required: false },
            container: { type: TYPE.String, required: false },
            isPublic: TYPE.Boolean,
          },
          action: ConduitRouteActions.POST,
          path: '/storage/fileByUrl',
          description: `Creates a new file and provides a URL to upload it to.`,
          middlewares: ['authMiddleware'],
        },
        new ConduitRouteReturnDefinition('CreateFileByUrl', File.name),
        this.fileHandlers.createFileUploadUrl.bind(this.fileHandlers),
      );
      this._routingManager.route(
        {
          urlParams: {
            id: { type: TYPE.String, required: true },
          },
          bodyParams: {
            name: { type: TYPE.String, required: false },
            mimeType: { type: TYPE.String, required: false },
            folder: { type: TYPE.String, required: false },
            size: { type: TYPE.Number, required: false },
            container: { type: TYPE.String, required: false },
          },
          action: ConduitRouteActions.PATCH,
          path: '/storage/updateByUrl',
          description: `Updates a file and provides a URL to upload it to.`,
          middlewares: ['authMiddleware'],
        },
        new ConduitRouteReturnDefinition('UpdateFileByUrl', 'String'),
        this.fileHandlers.updateFileUploadUrl.bind(this.fileHandlers),
      );
      this._routingManager.route(
        {
          urlParams: {
            id: { type: TYPE.String, required: true },
          },
          action: ConduitRouteActions.GET,
          middlewares: ['authMiddleware'],
          path: '/storage/file/data/:id',
          description: `Returns the data of a file.`,
        },
        new ConduitRouteReturnDefinition('FileData', {
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
          description: `Deletes a file.`,
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
          description: `Updates a file.`,
          middlewares: ['authMiddleware'],
        },
        new ConduitRouteReturnDefinition('FileUpdateResponse', File.name),
        this.fileHandlers.updateFile.bind(this.fileHandlers),
      );
    }

    await this._routingManager.registerRoutes();
  }
}
