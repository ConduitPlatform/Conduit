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
  ConduitRouteObject,
  Query,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash';
import { FileHandlers } from '../handlers/file';
import { _StorageContainer, _StorageFolder, File } from '../models';

export class AdminRoutes {
  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly fileHandlers: FileHandlers,
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
        patchFile: this.fileHandlers.updateFile.bind(this.fileHandlers),
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
        ConduitGrpcSdk.Logger.error('Failed to register admin routes for module!');
        ConduitGrpcSdk.Logger.error(err);
      });
  }

  private getRegisteredRoutes(): ConduitRouteObject[] {
    return [
      constructConduitRoute(
        {
          path: '/files/:id',
          action: ConduitRouteActions.GET,
          description: `Returns a file.`,
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
        },
        new ConduitRouteReturnDefinition('File', File.getInstance().fields),
        'getFile',
      ),
      constructConduitRoute(
        {
          path: '/files',
          action: ConduitRouteActions.GET,
          description: `Returns queried files.`,
          queryParams: {
            skip: ConduitNumber.Required,
            limit: ConduitNumber.Required,
            sort: ConduitString.Optional,
            search: ConduitString.Optional,
            folder: ConduitString.Optional,
            container: ConduitString.Required,
          },
        },
        new ConduitRouteReturnDefinition('Files', {
          files: ['File'],
          filesCount: ConduitNumber.Required,
        }),
        'getFiles',
      ),
      constructConduitRoute(
        {
          path: '/files',
          action: ConduitRouteActions.POST,
          description: `Creates a new file.`,
          bodyParams: {
            name: ConduitString.Required,
            data: ConduitString.Required,
            folder: ConduitString.Optional,
            container: ConduitString.Optional,
            mimeType: ConduitString.Optional,
            isPublic: ConduitBoolean.Optional,
          },
        },
        new ConduitRouteReturnDefinition('CreateFile', File.getInstance().fields),
        'createFile',
      ),
      constructConduitRoute(
        {
          path: '/files/:id',
          action: ConduitRouteActions.PATCH,
          description: `Updates a file.`,
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
          bodyParams: {
            name: ConduitString.Optional,
            data: ConduitString.Optional,
            folder: ConduitString.Optional,
            container: ConduitString.Optional,
            mimeType: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition('PatchFile', File.getInstance().fields),
        'patchFile',
      ),
      constructConduitRoute(
        {
          path: '/files/:id',
          action: ConduitRouteActions.DELETE,
          description: `Deletes a file.`,
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
        },
        new ConduitRouteReturnDefinition('DeleteFile', {
          success: ConduitString.Required,
        }),
        'deleteFile',
      ),
      constructConduitRoute(
        {
          path: '/files/:id/url',
          action: ConduitRouteActions.GET,
          description: `Returns the file's url and optionally redirects to it.`,
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
          queryParams: {
            redirect: ConduitBoolean.Optional,
          },
        },
        new ConduitRouteReturnDefinition('GetFileUrl', {
          url: ConduitString.Optional,
          redirect: ConduitString.Optional,
        }),
        'getFileUrl',
      ),
      constructConduitRoute(
        {
          path: '/files/:id/data',
          action: ConduitRouteActions.GET,
          description: `Returns the data of a file.`,
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
        },
        new ConduitRouteReturnDefinition('GetFileData', {
          data: ConduitString.Required,
        }),
        'getFileData',
      ),
      constructConduitRoute(
        {
          path: '/folders',
          action: ConduitRouteActions.GET,
          description: `Returns queried folders.`,
          queryParams: {
            skip: ConduitNumber.Required,
            limit: ConduitNumber.Required,
            sort: ConduitString.Optional,
            container: ConduitString.Optional,
            parent: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition('getFolders', {
          folders: [_StorageFolder.getInstance().fields],
          folderCount: ConduitNumber.Required,
        }),
        'getFolders',
      ),
      constructConduitRoute(
        {
          path: '/folders',
          action: ConduitRouteActions.POST,
          description: `Creates a new folder.`,
          bodyParams: {
            name: ConduitString.Required,
            container: ConduitString.Required,
            isPublic: ConduitBoolean.Optional,
          },
        },
        new ConduitRouteReturnDefinition(
          'CreateFolder',
          _StorageFolder.getInstance().fields,
        ),
        'createFolder',
      ),
      constructConduitRoute(
        {
          path: '/folders/:id',
          action: ConduitRouteActions.DELETE,
          description: `Deletes a folder.`,
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
        },
        new ConduitRouteReturnDefinition('DeleteFolder', 'String'),
        'deleteFolder',
      ),
      constructConduitRoute(
        {
          path: '/containers',
          action: ConduitRouteActions.GET,
          description: `Returns queried containers.`,
          queryParams: {
            skip: ConduitNumber.Required,
            limit: ConduitNumber.Required,
            sort: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition('GetContainers', {
          containers: [_StorageContainer.getInstance().fields],
          containersCount: ConduitNumber.Required,
        }),
        'getContainers',
      ),
      constructConduitRoute(
        {
          path: '/containers',
          action: ConduitRouteActions.POST,
          description: `Creates a new container.`,
          bodyParams: {
            name: ConduitString.Required,
            isPublic: ConduitBoolean.Optional,
          },
        },
        new ConduitRouteReturnDefinition(
          'CreateContainer',
          _StorageContainer.getInstance().fields,
        ),
        'createContainer',
      ),
      constructConduitRoute(
        {
          path: '/containers/:id',
          action: ConduitRouteActions.DELETE,
          description: `Deletes a container.`,
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
        },
        new ConduitRouteReturnDefinition(
          'DeleteContainer',
          _StorageContainer.getInstance().fields,
        ),
        'deleteContainer',
      ),
    ];
  }

  async getFiles(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { skip, limit, sort, folder, search } = call.request.params;
    const query: Query = {
      container: call.request.params.container,
    };

    if (!isNil(folder)) {
      query.folder =
        folder.trim().slice(-1) !== '/' ? folder.trim() + '/' : folder.trim();
    }
    if (!isNil(search)) {
      query.name = { $regex: `.*${search}.*`, $options: 'i' };
    }

    const files = await File.getInstance().findMany(query, undefined, skip, limit, sort);
    const filesCount = await File.getInstance().countDocuments(query);

    return { files, filesCount };
  }

  async getFolders(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { sort } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    const query: Query = {
      container: call.request.params.container,
    };
    if (!isNil(call.request.params.parent)) {
      query.name = {
        $regex: `${call.request.params.parent}\/([^\/]+)\/?$`,
        $options: 'i',
      };
    }
    const folders = await _StorageFolder
      .getInstance()
      .findMany(query, undefined, skip, limit, sort);
    const folderCount = await _StorageFolder.getInstance().countDocuments(query);
    return { folders, folderCount };
  }

  async createFolder(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { name, container, isPublic } = call.request.params;
    const containerDocument = await _StorageContainer
      .getInstance()
      .findOne({ name: container });
    if (isNil(containerDocument)) {
      await this._createContainer(container, isPublic).catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    }
    const newName = name.trim().slice(-1) !== '/' ? name.trim() + '/' : name.trim();
    let folder = await _StorageFolder.getInstance().findOne({
      name: newName,
      container,
    });
    if (isNil(folder)) {
      folder = await _StorageFolder.getInstance().create({
        name: newName,
        container,
        isPublic,
      });
      const exists = await this.fileHandlers.storage
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
    const { id } = call.request.params;

    const folder = await _StorageFolder.getInstance().findOne({
      _id: id,
    });
    if (isNil(folder)) {
      throw new GrpcError(status.NOT_FOUND, 'Folder does not exist');
    } else {
      await this.fileHandlers.storage
        .container(folder.container)
        .deleteFolder(folder.name);
      await _StorageFolder.getInstance().deleteOne({
        name: folder.name,
        container: folder.container,
      });
      await File.getInstance().deleteMany({
        folder: folder.name,
        container: folder.container,
      });
    }
    return 'OK';
  }

  async getContainers(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { sort } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    const containers = await _StorageContainer
      .getInstance()
      .findMany({}, undefined, skip, limit, sort);
    const containersCount = await _StorageContainer.getInstance().countDocuments({});

    return { containers, containersCount };
  }

  async createContainer(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { name, isPublic } = call.request.params;
    return await this._createContainer(name, isPublic);
  }

  async deleteContainer(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id } = call.request.params;
    try {
      const container = await _StorageContainer.getInstance().findOne({
        _id: id,
      });
      if (isNil(container)) {
        throw new GrpcError(status.NOT_FOUND, 'Container does not exist');
      } else {
        await this.fileHandlers.storage.deleteContainer(container.name);
        await _StorageContainer.getInstance().deleteOne({
          _id: id,
        });
        await File.getInstance().deleteMany({
          container: container.name,
        });
        await _StorageFolder.getInstance().deleteMany({
          container: container.name,
        });
      }
      return container;
    } catch (e) {
      throw new GrpcError(
        status.INTERNAL,
        (e as Error).message ?? 'Something went wrong',
      );
    }
  }

  private async _createContainer(name: string, isPublic: boolean | undefined) {
    try {
      let container = await _StorageContainer.getInstance().findOne({
        name,
      });
      if (isNil(container)) {
        const exists = await this.fileHandlers.storage.containerExists(name);

        if (!exists) {
          await this.fileHandlers.storage.createContainer(name);
        }
        container = await _StorageContainer.getInstance().create({
          name,
          isPublic,
        });
      } else {
        throw new GrpcError(status.ALREADY_EXISTS, 'Container already exists');
      }
      return container;
    } catch (e) {
      throw new GrpcError(
        status.INTERNAL,
        (e as Error).message ?? 'Something went wrong',
      );
    }
  }
}
