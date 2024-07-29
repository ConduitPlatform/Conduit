import { FileHandlers } from '../handlers/file.js';
import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitNumber,
  ConduitString,
  ConfigController,
  GrpcServer,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { File } from '../models/index.js';

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
    const authzEnabled = ConfigController.getInstance().config.authorization.enabled;
    this._routingManager.route(
      {
        urlParams: {
          id: { type: TYPE.String, required: true },
        },
        queryParams: {
          ...(authzEnabled && { scope: { type: TYPE.String, required: false } }),
        },
        action: ConduitRouteActions.GET,
        path: '/storage/file/:id',
        middlewares: ['authMiddleware?'],
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
          ...(authzEnabled && { scope: { type: TYPE.String, required: false } }),
        },
        middlewares: ['authMiddleware?'],
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
            name: { type: TYPE.String, required: false },
            alias: { type: TYPE.String, required: false },
            mimeType: TYPE.String,
            data: { type: TYPE.String, required: true },
            folder: { type: TYPE.String, required: false },
            container: { type: TYPE.String, required: false },
            isPublic: TYPE.Boolean,
          },
          queryParams: {
            ...(authzEnabled && { scope: { type: TYPE.String, required: false } }),
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
            name: { type: TYPE.String, required: false },
            alias: { type: TYPE.String, required: false },
            mimeType: TYPE.String,
            folder: { type: TYPE.String, required: false },
            size: { type: TYPE.Number, required: false },
            container: { type: TYPE.String, required: false },
            isPublic: TYPE.Boolean,
          },
          queryParams: {
            ...(authzEnabled && { scope: { type: TYPE.String, required: false } }),
          },
          action: ConduitRouteActions.POST,
          path: '/storage/upload',
          description: `Creates a new file and provides a URL to upload it to.`,
          middlewares: ['authMiddleware'],
        },
        new ConduitRouteReturnDefinition('CreateFileByUrl', {
          file: File.getInstance().fields,
          url: ConduitString.Required,
        }),
        this.fileHandlers.createFileUploadUrl.bind(this.fileHandlers),
      );
      this._routingManager.route(
        {
          urlParams: {
            id: { type: TYPE.String, required: true },
          },
          bodyParams: {
            name: ConduitString.Optional,
            alias: ConduitString.Optional,
            folder: ConduitString.Optional,
            container: ConduitString.Optional,
            mimeType: ConduitString.Optional,
            size: ConduitNumber.Optional,
          },
          queryParams: {
            ...(authzEnabled && { scope: { type: TYPE.String, required: false } }),
          },
          action: ConduitRouteActions.PATCH,
          path: '/storage/upload/:id',
          description: `Updates a file and provides a URL to upload its data to.`,
          middlewares: ['authMiddleware'],
        },
        new ConduitRouteReturnDefinition('PatchFileByUrl', {
          file: File.getInstance().fields,
          url: ConduitString.Required,
        }),
        this.fileHandlers.updateFileUploadUrl.bind(this.fileHandlers),
      );
      this._routingManager.route(
        {
          urlParams: {
            id: { type: TYPE.String, required: true },
          },
          queryParams: {
            ...(authzEnabled && { scope: { type: TYPE.String, required: false } }),
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
          queryParams: {
            ...(authzEnabled && { scope: { type: TYPE.String, required: false } }),
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
          queryParams: {
            ...(authzEnabled && { scope: { type: TYPE.String, required: false } }),
          },
          bodyParams: {
            name: ConduitString.Optional,
            alias: ConduitString.Optional,
            folder: ConduitString.Optional,
            container: ConduitString.Optional,
            data: ConduitString.Required,
            mimeType: ConduitString.Optional,
          },
          action: ConduitRouteActions.PATCH,
          path: '/storage/file/:id',
          description: `Updates a file.`,
          middlewares: ['authMiddleware'],
        },
        new ConduitRouteReturnDefinition('PatchFile', File.name),
        this.fileHandlers.updateFile.bind(this.fileHandlers),
      );
    }

    await this._routingManager.registerRoutes();
  }
}
