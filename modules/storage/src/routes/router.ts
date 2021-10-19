import File from '../models/File';
import { FileHandlers } from '../handlers/file';
import ConduitGrpcSdk, {
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  constructRoute,
  GrpcServer,
  TYPE,
} from '@quintessential-sft/conduit-grpc-sdk';

export class FileRoutes {
  constructor(
    readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly fileHandlers: FileHandlers
  ) {
    this.grpcSdk.router
      .registerRouter(server, this.registeredRoutes, {
        createFile: this.fileHandlers.createFile.bind(this.fileHandlers),
        deleteFile: this.fileHandlers.deleteFile.bind(this.fileHandlers),
        getFile: this.fileHandlers.getFile.bind(this.fileHandlers),
        getFileData: this.fileHandlers.getFileData.bind(this.fileHandlers),
        updateFile: this.fileHandlers.updateFile.bind(this.fileHandlers),
        getFileUrl: this.fileHandlers.getFileUrl.bind(this.fileHandlers),
      })
      .catch((err: Error) => {
        console.log('Failed to register routes for module');
        console.log(err);
      });
  }

  get registeredRoutes(): any[] {
    let routesArray: any = [];
    routesArray.push(
      constructRoute(
        new ConduitRoute(
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
          new ConduitRouteReturnDefinition('File', {
            _id: TYPE.String,
            name: TYPE.String,
            url: TYPE.String,
          }),
          'createFile'
        )
      )
    );

    routesArray.push(
      constructRoute(
        new ConduitRoute(
          {
            urlParams: {
              id: { type: TYPE.String, required: true },
            },
            action: ConduitRouteActions.GET,
            path: '/storage/file/:id',
          },
          new ConduitRouteReturnDefinition('File', {
            _id: TYPE.String,
            name: TYPE.String,
            url: TYPE.String,
          }),
          'getFile'
        )
      )
    );

    routesArray.push(
      constructRoute(
        new ConduitRoute(
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
          'getFileData'
        )
      )
    );

    routesArray.push(
      constructRoute(
        new ConduitRoute(
          {
            urlParams: {
              id: { type: TYPE.String, required: true },
            },
            action: ConduitRouteActions.GET,
            path: '/storage/getFileUrl/:id',
          },
          new ConduitRouteReturnDefinition('FileUrl', 'String'),
          'getFileUrl'
        )
      )
    );

    routesArray.push(
      constructRoute(
        new ConduitRoute(
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
          'deleteFile'
        )
      )
    );

    routesArray.push(
      constructRoute(
        new ConduitRoute(
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
          new ConduitRouteReturnDefinition('FileUpdateResponse', {
            _id: TYPE.String,
            name: TYPE.String,
            url: TYPE.String,
          }),
          'updateFile'
        )
      )
    );

    return routesArray;
  }
}
