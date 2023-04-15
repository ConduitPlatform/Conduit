import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
  ParsedRouterRequest,
  Query,
  RouteOptionType,
  TYPE,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitBoolean,
  ConduitNumber,
  ConduitString,
  GrpcServer,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash';
import { FileHandlers } from '../handlers/file';
import { _StorageContainer, _StorageFolder, File } from '../models';

export class AdminRoutes {
  private readonly routingManager: RoutingManager;

  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly fileHandlers: FileHandlers,
  ) {
    this.routingManager = new RoutingManager(this.grpcSdk.admin, this.server);
    this.registerAdminRoutes();
  }

  async getFiles(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { sort, folder, search } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    const query: Query<File> = {
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
    const { sort, parent, search } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    const query: Query<_StorageFolder> = {
      container: call.request.params.container,
    };
    if (!isNil(search)) {
      query.name = { $regex: search, $options: 'i' };
    }
    if (!isNil(parent)) {
      const regexSuffix = !isNil(search) ? search : '([^/]+)/?$';
      query.name = {
        $regex: `${parent}\/${regexSuffix}`,
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

  private registerAdminRoutes() {
    this.routingManager.clear();
    this.routingManager.route(
      {
        path: '/files/:id',
        action: ConduitRouteActions.GET,
        description: `Returns a file.`,
        urlParams: {
          id: { type: RouteOptionType.String, required: true },
        },
      },
      new ConduitRouteReturnDefinition(File.name),
      this.fileHandlers.getFile.bind(this.fileHandlers),
    );
    this.routingManager.route(
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
      new ConduitRouteReturnDefinition('GetFiles', {
        files: [File.name],
        filesCount: ConduitNumber.Required,
      }),
      this.getFiles.bind(this),
    );
    this.routingManager.route(
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
      new ConduitRouteReturnDefinition('CreateFile', File.name),
      this.fileHandlers.createFile.bind(this.fileHandlers),
    );
    this.routingManager.route(
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
        path: '/files/upload',
        description: `Creates a new file and provides a URL to upload it to.`,
      },
      new ConduitRouteReturnDefinition('CreateFileByUrl', File.name),
      this.fileHandlers.createFileUploadUrl.bind(this.fileHandlers),
    );
    this.routingManager.route(
      {
        path: '/files/:id',
        action: ConduitRouteActions.PATCH,
        description: `Updates a file.`,
        urlParams: {
          id: { type: RouteOptionType.String, required: true },
        },
        bodyParams: {
          name: ConduitString.Optional,
          folder: ConduitString.Optional,
          container: ConduitString.Optional,
          data: ConduitString.Required,
          mimeType: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('PatchFile', File.name),
      this.fileHandlers.updateFile.bind(this.fileHandlers),
    );
    this.routingManager.route(
      {
        urlParams: {
          id: { type: TYPE.String, required: true },
        },
        bodyParams: {
          name: ConduitString.Optional,
          folder: ConduitString.Optional,
          container: ConduitString.Optional,
          mimeType: ConduitString.Optional,
          size: ConduitNumber.Optional,
        },
        action: ConduitRouteActions.PATCH,
        path: '/files/upload/:id',
        description: `Updates a file and provides a URL to upload its data to.`,
      },
      new ConduitRouteReturnDefinition('PatchFileByUrl', 'String'),
      this.fileHandlers.updateFileUploadUrl.bind(this.fileHandlers),
    );
    this.routingManager.route(
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
      this.fileHandlers.deleteFile.bind(this.fileHandlers),
    );
    this.routingManager.route(
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
      this.fileHandlers.getFileUrl.bind(this.fileHandlers),
    );
    this.routingManager.route(
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
      this.fileHandlers.getFileData.bind(this.fileHandlers),
    );
    this.routingManager.route(
      {
        path: '/folders',
        action: ConduitRouteActions.GET,
        description: `Returns queried folders.`,
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          sort: ConduitString.Optional,
          container: ConduitString.Optional,
          parent: ConduitString.Optional,
          search: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('getFolders', {
        folders: [_StorageFolder.name],
        folderCount: ConduitNumber.Required,
      }),
      this.getFolders.bind(this),
    );
    this.routingManager.route(
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
      new ConduitRouteReturnDefinition('CreateFolder', _StorageFolder.name),
      this.createFolder.bind(this),
    );
    this.routingManager.route(
      {
        path: '/folders/:id',
        action: ConduitRouteActions.DELETE,
        description: `Deletes a folder.`,
        urlParams: {
          id: { type: RouteOptionType.String, required: true },
        },
      },
      new ConduitRouteReturnDefinition('DeleteFolder', 'String'),
      this.deleteFolder.bind(this),
    );
    this.routingManager.route(
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
        containers: [_StorageContainer.name],
        containersCount: ConduitNumber.Required,
      }),
      this.getContainers.bind(this),
    );
    this.routingManager.route(
      {
        path: '/containers',
        action: ConduitRouteActions.POST,
        description: `Creates a new container.`,
        bodyParams: {
          name: ConduitString.Required,
          isPublic: ConduitBoolean.Optional,
        },
      },
      new ConduitRouteReturnDefinition(_StorageContainer.name),
      this.createContainer.bind(this),
    );
    this.routingManager.route(
      {
        path: '/containers/:id',
        action: ConduitRouteActions.DELETE,
        description: `Deletes a container.`,
        urlParams: {
          id: { type: RouteOptionType.String, required: true },
        },
      },
      new ConduitRouteReturnDefinition('DeleteContainer', _StorageContainer.name),
      this.deleteContainer.bind(this),
    );
    this.routingManager.registerRoutes();
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
