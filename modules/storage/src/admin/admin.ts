import ConduitGrpcSdk, {
  GrpcServer,
  constructConduitRoute,
  ParsedRouterRequest,
  UnparsedRouterResponse,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
  RouteOptionType,
  ConduitString,
  ConduitNumber,
  ConduitBoolean,
} from '@quintessential-sft/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash';
import { FileHandlers } from '../handlers/file';
import {
  _StorageContainer,
  _StorageFolder,
  File,
} from '../models'

export class AdminRoutes {

  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly fileHandlers: FileHandlers
  ) {
    this.registerAdminRoutes();
  }

  private registerAdminRoutes() {
    const paths = this.getRegisteredRoutes();
    this.grpcSdk.admin
      .registerAdminAsync(this.server, paths, {
        getFile: this.fileHandlers.getFile.bind(this.fileHandlers),
        getFiles: this.getFiles.bind(this),
        createFile: this.fileHandlers.createFile.bind(this.fileHandlers),
        editFile: this.fileHandlers.updateFile.bind(this.fileHandlers),
        deleteFile: this.fileHandlers.deleteFile.bind(this.fileHandlers),
        getFileUrl: this.fileHandlers.getFileUrl.bind(this.fileHandlers),
        getFileData: this.fileHandlers.getFileData.bind(this.fileHandlers),
        getFolders: this.getFolders.bind(this),
        createFolder: this.createFolder.bind(this),
        deleteFolder: this.deleteFolder.bind(this),
        getContainers: this.getContainers.bind(this),
        createContainer: this.createContainer.bind(this),
        deleteContainer: this.deleteContainer.bind(this),
      })
      .catch((err: Error) => {
        console.log('Failed to register admin routes for module!');
        console.error(err);
      });
  }

  private getRegisteredRoutes(): any[] {
    return [
      constructConduitRoute(
        {
          path: '/file/:id',
          action: ConduitRouteActions.GET,
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
        },
        new ConduitRouteReturnDefinition('File', {
          id: ConduitString.Required,
          name: ConduitString.Required,
          url: ConduitString.Required,
        }),
        'getFile'
      ),
      constructConduitRoute(
        {
          path: '/file',
          action: ConduitRouteActions.GET,
          queryParams: {
            skip: ConduitNumber.Required,
            limit: ConduitNumber.Required,
            folder: ConduitString.Optional,
            // container: ConduitString.Required,
            search: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition('Files', {
          files: ['File'],
          filesCount: ConduitNumber.Required,
        }),
        'getFiles'
      ),
      constructConduitRoute(
        {
          path: '/file',
          action: ConduitRouteActions.POST,
          bodyParams: {
            name: ConduitString.Required,
            data: ConduitString.Required,
            folder: ConduitString.Required,
            container: ConduitString.Optional,
            mimeType: ConduitString.Required,
            isPublic: ConduitBoolean.Optional,
          }
        },
        new ConduitRouteReturnDefinition('CreateFile', {
          id: ConduitString.Required,
          name: ConduitString.Required,
          url: ConduitString.Required,
        }),
        'createFile'
      ),
      constructConduitRoute(
        {
          path: '/file/:id',
          action: ConduitRouteActions.UPDATE, // works as PATCH (frontend compat)
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
          bodyParams: {
            name: ConduitString.Required,
            data: ConduitString.Required,
            folder: ConduitString.Required,
            container: ConduitString.Optional,
            mimeType: ConduitString.Required,
          }
        },
        new ConduitRouteReturnDefinition('EditFile', {
          id: ConduitString.Required,
          name: ConduitString.Required,
          url: ConduitString.Required,
        }),
        'editFile'
      ),
      constructConduitRoute(
        {
          path: '/file/:id',
          action: ConduitRouteActions.DELETE,
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
        },
        new ConduitRouteReturnDefinition('DeleteFile', {
          success: ConduitString.Required,
        }),
        'deleteFile'
      ),
      constructConduitRoute(
        {
          path: '/getFileUrl/:id',
          action: ConduitRouteActions.GET,
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
          queryParams: {
            redirect: ConduitBoolean.Optional,
          }
        },
        new ConduitRouteReturnDefinition('GetFileUrl', {
          url: ConduitString.Optional,
          redirect: ConduitString.Optional,
        }),
        'getFileUrl'
      ),
      constructConduitRoute(
        {
          path: '/file/:id/data',
          action: ConduitRouteActions.GET,
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
        },
        new ConduitRouteReturnDefinition('GetFileData', {
          data: ConduitString.Required,
        }),
        'getFileData'
      ),
      constructConduitRoute(
        {
          path: '/folder',
          action: ConduitRouteActions.GET,
          queryParams: {
            skip: ConduitNumber.Required,
            limit: ConduitNumber.Required,
            container: ConduitString.Optional,
            parent: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition('getFolders', {
          folders: [_StorageFolder.getInstance().fields],
          folderCount: ConduitNumber.Required,
        }),
        'getFolders'
      ),
      constructConduitRoute(
        {
          path: '/folder',
          action: ConduitRouteActions.POST,
          bodyParams: {
            name: ConduitString.Required,
            container: ConduitString.Required,
            isPublic: ConduitBoolean.Optional,
          },
        },
        new ConduitRouteReturnDefinition('CreateFolder', _StorageFolder.getInstance().fields),
        'createFolder'
      ),
      constructConduitRoute(
        {
          path: '/folder/:id',
          action: ConduitRouteActions.DELETE,
          urlParams: {
            id: { type: RouteOptionType.String, required: true }, // currently unused (unique: name, container)
          },
          bodyParams: {
            name: ConduitString.Required,
            container: ConduitString.Required,
          },
        },
        new ConduitRouteReturnDefinition('DeleteFolder', 'String'),
        'deleteFolder'
      ),
      constructConduitRoute(
        {
          path: '/container',
          action: ConduitRouteActions.GET,
          queryParams: {
            skip: ConduitNumber.Required,
            limit: ConduitNumber.Required,
          },
        },
        new ConduitRouteReturnDefinition('GetContainers', {
          containers: [_StorageContainer.getInstance().fields],
          containersCount: ConduitNumber.Required,
        }),
        'getContainers'
      ),
      constructConduitRoute(
        {
          path: '/container',
          action: ConduitRouteActions.POST,
          bodyParams: {
            name: ConduitString.Required,
            isPublic: ConduitBoolean.Optional,
          },
        },
        new ConduitRouteReturnDefinition('CreateContainer', _StorageContainer.getInstance().fields),
        'createContainer'
      ),
      constructConduitRoute(
        {
          path: '/container/:id',
          action: ConduitRouteActions.DELETE,
          urlParams: {
            id: { type: RouteOptionType.String, required: true }, // currently unused (unique: name)
          },
          bodyParams: {
            name: ConduitString.Required,
          }
        },
        new ConduitRouteReturnDefinition('DeleteContainer', _StorageContainer.getInstance().fields),
        'deleteContainer'
      ),
    ];
  }

  async getFiles(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { skip, limit, folder, search } = call.request.params;
    let query: { container: string; folder?: string | null; name?: any } = { container: call.request.params.container };

    if (!isNil(folder)) {
      query.folder =  (folder.trim().slice(-1) !== '/') ? folder.trim() + '/' : folder.trim();
    } else {
      query.folder = null;
    }
    if (!isNil(search)) {
      query.name = { $regex: `.*${search}.*`, $options: 'i' };
    }

    let files = await File.getInstance()
      .findMany(
        query,
        undefined,
        skip,
        limit
      );
    let filesCount = await File.getInstance().countDocuments(query);

    return { files, filesCount };
  }

  async getFolders(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    let query: { container: string; name?: any } = {
      container: call.request.params.container,
    };
    if (!isNil(call.request.params.parent)) {
      query.name = { $regex: `${call.request.params.parent}\/([^\/]+)\/?$`, $options: 'i'};
    }
    let folders = await _StorageFolder.getInstance()
      .findMany(
        query,
        undefined,
        call.request.params.skip,
        call.request.params.limit,
      );
    let folderCount = await _StorageFolder.getInstance().countDocuments(query);
    return { folders, folderCount };
  }

  async createFolder(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { name, container, isPublic } = call.request.params;
    const newName = (name.trim().slice(-1) !== '/') ? name.trim() + '/' : name.trim();
    let folder = await _StorageFolder.getInstance()
      .findOne({
        name: newName,
        container,
      });
    if (isNil(folder)) {
      folder = await _StorageFolder.getInstance()
        .create({
          name: newName,
          container,
          isPublic,
        });
      let exists = await this.fileHandlers.storage
        .container(container)
        .folderExists(newName);
      if (!exists) {
        await this.fileHandlers.storage.container(container).createFolder(newName);
      }
    } else {
      throw new GrpcError(status.ALREADY_EXISTS, 'Folder already exists');
    }
    return folder;
  }

  async deleteFolder(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { name, container } = call.request.params;
    const newName = (name.trim().slice(-1) !== '/') ? name.trim() + '/' : name.trim();

    let folder = await _StorageFolder.getInstance()
      .findOne({
        name: newName,
        container,
      });
    if (isNil(folder)) {
      throw new GrpcError(status.NOT_FOUND, 'Folder does not exist');
    } else {
      await this.fileHandlers.storage.container(container).deleteFolder(name);
      await _StorageFolder.getInstance()
      .deleteOne({
        name: newName,
        container,
      });
      await File.getInstance()
        .deleteMany({
          folder: newName,
          container,
        });
    }
    return 'OK';
  }

  async getContainers(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    let containers = await _StorageContainer.getInstance()
      .findMany(
        {},
        undefined,
        call.request.params.skip,
        call.request.params.limit
      );
    let containersCount = await _StorageContainer.getInstance().countDocuments({});

    return { containers, containersCount };
  }

  async createContainer(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { name, isPublic } = call.request.params;
    try {
      let container = await _StorageContainer.getInstance()
        .findOne({
          name,
        });
      if (isNil(container)) {
        let exists = await this.fileHandlers.storage.containerExists(name);
        if (!exists) {
          await this.fileHandlers.storage.createContainer(name);
        }
        container = await _StorageContainer.getInstance()
          .create({
            name,
            isPublic,
          });
      } else {
        throw new GrpcError(status.ALREADY_EXISTS, 'Container already exists');
      }
      return container;
    } catch (e) {
      throw new GrpcError(e.status ?? status.INTERNAL, e.message ?? 'Something went wrong');
    }
  }

  async deleteContainer(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { name } = call.request.params;
    try {
      let container = await _StorageContainer.getInstance()
        .findOne({
          name,
        });
      if (isNil(container)) {
        throw new GrpcError(status.NOT_FOUND, 'Container does not exist');
      } else {
        await this.fileHandlers.storage.deleteContainer(name);
        await _StorageContainer.getInstance()
          .deleteOne({
            name,
          });
        await File.getInstance()
          .deleteMany({
            container: name,
          });
        await _StorageFolder.getInstance()
          .deleteMany({
            container: name,
          });
      }
      return container;
    } catch (e) {
      throw new GrpcError(e.status ?? status.INTERNAL, e.message ?? 'Something went wrong');
    }
  }
}
