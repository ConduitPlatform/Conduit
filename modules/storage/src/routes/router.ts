import File from '../models/File';
import { FileHandlers } from '../handlers/file';
import { IStorageProvider } from '@quintessential-sft/storage-provider';
import {
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  TYPE,
  constructRoute,
  GrpcServer,
} from '@quintessential-sft/conduit-grpc-sdk';
import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';

export class FileRoutes {
  private readonly fileHandlers: FileHandlers;

  constructor(
    readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly storageProvider: IStorageProvider
  ) {
    this.fileHandlers = new FileHandlers(grpcSdk, storageProvider);
    this.grpcSdk.router
      .registerRouter(server, this.registeredRoutes, {
        createFile: this.fileHandlers.createFile.bind(this.fileHandlers),
        deleteFile: this.fileHandlers.deleteFile.bind(this.fileHandlers),
        getFile: this.fileHandlers.getFile.bind(this.fileHandlers),
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
              name: TYPE.String,
              mimeType: TYPE.String,
              data: TYPE.String,
              folder: TYPE.String,
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
              id: TYPE.String,
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
              id: TYPE.String,
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
              id: TYPE.String,
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
              id: TYPE.String,
            },
            bodyParams: {
              name: TYPE.String,
              mimeType: TYPE.String,
              data: TYPE.String,
              folder: TYPE.String,
            },
            action: ConduitRouteActions.UPDATE,
            path: '/storage/file',
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
