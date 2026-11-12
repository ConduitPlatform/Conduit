import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ParsedRouterRequest,
  Query,
  TYPE,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitBoolean,
  ConduitNumber,
  ConduitString,
  ConfigController,
  GrpcServer,
  ModuleError,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { isEmpty, isNil } from 'lodash-es';
import { _StorageContainer, _StorageFolder, File } from '../models/index.js';
import { normalizeFolderPath, sanitizeFilesForResponse } from '../utils/index.js';
import { errors } from '../errors.js';
import { AdminFileHandlers } from './adminFile.js';
import { rethrowGrpcOrInternal, resolveScope } from '../authz/helpers.js';
import { findOrCreateFolders } from '../authz/folders.js';
import { createContainerOwnerRelation } from '../authz/relations.js';
import { deleteContainerTree, deleteFolderTree } from '../authz/cascade.js';

export class AdminRoutes {
  private readonly routingManager: RoutingManager;

  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly fileHandlers: AdminFileHandlers,
  ) {
    this.routingManager = new RoutingManager(this.grpcSdk.admin, this.server);
    this.registerAdminRoutes();
  }

  async getFiles(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { sort, folder, search } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    const query: Query<File> = {
      $and: [{ container: call.request.params.container }],
    };

    if (!isNil(folder)) {
      query.$and?.push({
        folder: folder.trim().slice(-1) !== '/' ? folder.trim() + '/' : folder.trim(),
      });
    }
    if (!isNil(search)) {
      query.$and?.push({
        $or: [
          { name: { $regex: `.*${search}.*`, $options: 'i' } },
          { alias: { $regex: `.*${search}.*`, $options: 'i' } },
        ],
      });
    }

    const files = await File.getInstance().findMany(query, { skip, limit, sort });
    const filesCount = await File.getInstance().countDocuments(query);

    return { files: await sanitizeFilesForResponse(files), filesCount };
  }

  async getFolders(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { sort, parent, search } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    const query: Query<_StorageFolder> = {
      container: call.request.params.container,
    };
    if (isNil(parent)) {
      // match search or everything
      query.name = {
        $regex: !isNil(search) ? search : '([^/]+)/?$',
        $options: 'i',
      };
    } else if (isEmpty(parent)) {
      // match only single level / scope
      query.name = {
        $regex: !isNil(search) ? `^${search}[^/]+/$` : '^[^/]+/$',
        $options: 'i',
      };
    } else {
      // match only single level /parent scope
      const regexSuffix = !isNil(search) ? `([^/]*${search}[^/]*)/?$` : '[^/]+/$';
      query.name = {
        $regex: `^${parent.replace(/^\/|\/$/g, '')}/${regexSuffix}`,
        $options: 'i',
      };
    }
    const folders = await _StorageFolder
      .getInstance()
      .findMany(query, { skip, limit, sort });
    const folderCount = await _StorageFolder.getInstance().countDocuments(query);
    return { folders, folderCount };
  }

  async createFolder(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { container, isPublic } = call.request.params;
    const scope = resolveScope(call.request);
    const name = normalizeFolderPath(call.request.params.name);
    if (name === '/') {
      throw new ModuleError(errors.FOLDER_NAME_EMPTY);
    }
    const containerDocument = await _StorageContainer
      .getInstance()
      .findOne({ name: container });
    if (isNil(containerDocument)) {
      await this._createContainer(container, isPublic, scope);
    }
    const createdFolders = await findOrCreateFolders(
      this.grpcSdk,
      this.fileHandlers.storage,
      name,
      container,
      {
        isPublic,
        scope,
        lastExistsHandler: () => {
          throw new ModuleError(errors.FOLDER_ALREADY_EXISTS);
        },
      },
    );
    return createdFolders[createdFolders.length - 1];
  }

  async deleteFolder(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id } = call.request.params;

    const folder = await _StorageFolder.getInstance().findOne({
      _id: id,
    });
    if (isNil(folder)) {
      throw new ModuleError(errors.FOLDER_NOT_FOUND);
    }
    await deleteFolderTree(this.grpcSdk, this.fileHandlers.storage, folder);
    return 'OK';
  }

  async getContainers(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { sort } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    const containers = await _StorageContainer
      .getInstance()
      .findMany({}, { skip, limit, sort });
    const containersCount = await _StorageContainer.getInstance().countDocuments({});

    return { containers, containersCount };
  }

  async createContainer(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { name, isPublic } = call.request.params;
    return await this._createContainer(name, isPublic, resolveScope(call.request));
  }

  async deleteContainer(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id } = call.request.params;
    try {
      const container = await _StorageContainer.getInstance().findOne({
        _id: id,
      });
      if (isNil(container)) {
        throw new ModuleError(errors.CONTAINER_NOT_FOUND);
      }
      await deleteContainerTree(this.grpcSdk, this.fileHandlers.storage, container);
      return container;
    } catch (e) {
      rethrowGrpcOrInternal(e);
    }
  }

  private registerAdminRoutes() {
    this.routingManager.clear();
    const authzEnabled = ConfigController.getInstance().config.authorization.enabled;
    this.routingManager.route(
      {
        path: '/files/:id',
        errors: [errors.FILE_NOT_FOUND],
        action: ConduitRouteActions.GET,
        description: `Returns a file.`,
        urlParams: {
          id: { type: TYPE.String, required: true },
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
        errors: [
          errors.INVALID_FILE_DATA,
          errors.CONTAINER_CREATION_NOT_ALLOWED,
          errors.CONTAINER_NOT_FOUND,
          errors.FOLDER_NOT_FOUND,
          errors.FOLDER_PARENT_REQUIRED,
          errors.FILE_ALREADY_EXISTS,
          errors.PRIVATE_FILE_IN_PUBLIC_CONTAINER,
          errors.STORAGE_OPERATION_FAILED,
        ],
        action: ConduitRouteActions.POST,
        description: `Creates a new file.`,
        bodyParams: {
          name: ConduitString.Optional,
          alias: ConduitString.Optional,
          data: ConduitString.Required,
          folder: ConduitString.Optional,
          container: ConduitString.Optional,
          mimeType: ConduitString.Optional,
          isPublic: ConduitBoolean.Optional,
        },
        queryParams: {
          ...(authzEnabled && { scope: { type: TYPE.String, required: false } }),
        },
      },
      new ConduitRouteReturnDefinition('CreateFile', File.name),
      this.fileHandlers.createFile.bind(this.fileHandlers),
    );
    this.routingManager.route(
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
        path: '/files/upload',
        errors: [
          errors.CONTAINER_CREATION_NOT_ALLOWED,
          errors.CONTAINER_NOT_FOUND,
          errors.FOLDER_NOT_FOUND,
          errors.FOLDER_PARENT_REQUIRED,
          errors.FILE_ALREADY_EXISTS,
          errors.PRIVATE_FILE_IN_PUBLIC_CONTAINER,
          errors.STORAGE_OPERATION_FAILED,
        ],
        description: `Creates a new file and provides a URL to upload it to.`,
      },
      new ConduitRouteReturnDefinition('CreateFileByUrl', {
        file: File.getInstance().fields,
        url: ConduitString.Required,
      }),
      this.fileHandlers.createFileUploadUrl.bind(this.fileHandlers),
    );
    this.routingManager.route(
      {
        path: '/files/:id',
        errors: [
          errors.FILE_NOT_FOUND,
          errors.CONTAINER_CREATION_NOT_ALLOWED,
          errors.CONTAINER_NOT_FOUND,
          errors.FOLDER_NOT_FOUND,
          errors.FOLDER_PARENT_REQUIRED,
          errors.FILE_ALREADY_EXISTS,
          errors.PRIVATE_FILE_IN_PUBLIC_CONTAINER,
          errors.STORAGE_OPERATION_FAILED,
        ],
        action: ConduitRouteActions.PATCH,
        description: `Updates a file.`,
        urlParams: {
          id: { type: TYPE.String, required: true },
        },
        bodyParams: {
          name: ConduitString.Optional,
          alias: ConduitString.Optional,
          folder: ConduitString.Optional,
          container: ConduitString.Optional,
          data: ConduitString.Required,
          mimeType: ConduitString.Optional,
        },
        queryParams: {
          ...(authzEnabled && { scope: { type: TYPE.String, required: false } }),
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
        path: '/files/upload/:id',
        errors: [
          errors.FILE_NOT_FOUND,
          errors.CONTAINER_CREATION_NOT_ALLOWED,
          errors.CONTAINER_NOT_FOUND,
          errors.FOLDER_NOT_FOUND,
          errors.FOLDER_PARENT_REQUIRED,
          errors.FILE_ALREADY_EXISTS,
          errors.PRIVATE_FILE_IN_PUBLIC_CONTAINER,
          errors.STORAGE_OPERATION_FAILED,
        ],
        description: `Updates a file and provides a URL to upload its data to.`,
      },
      new ConduitRouteReturnDefinition('PatchFileByUrl', {
        file: File.getInstance().fields,
        url: ConduitString.Required,
      }),
      this.fileHandlers.updateFileUploadUrl.bind(this.fileHandlers),
    );
    this.routingManager.route(
      {
        path: '/files/:id',
        errors: [
          errors.INVALID_FILE_ID,
          errors.FILE_NOT_FOUND,
          errors.FILE_DELETE_FAILED,
          errors.STORAGE_OPERATION_FAILED,
        ],
        action: ConduitRouteActions.DELETE,
        description: `Deletes a file.`,
        urlParams: {
          id: { type: TYPE.String, required: true },
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
        errors: [errors.FILE_NOT_FOUND, errors.STORAGE_OPERATION_FAILED],
        action: ConduitRouteActions.GET,
        description: `Returns the file's url and optionally redirects to it.`,
        urlParams: {
          id: { type: TYPE.String, required: true },
        },
        queryParams: {
          redirect: ConduitBoolean.Optional,
          download: ConduitBoolean.Optional,
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
        errors: [
          errors.INVALID_FILE_ID,
          errors.FILE_NOT_FOUND,
          errors.STORAGE_OPERATION_FAILED,
        ],
        action: ConduitRouteActions.GET,
        description: `Returns the data of a file.`,
        urlParams: {
          id: { type: TYPE.String, required: true },
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
        errors: [
          errors.FOLDER_NAME_EMPTY,
          errors.FOLDER_ALREADY_EXISTS,
          errors.CONTAINER_NOT_FOUND,
          errors.CONTAINER_ALREADY_EXISTS,
          errors.FOLDER_PARENT_REQUIRED,
          errors.STORAGE_OPERATION_FAILED,
        ],
        action: ConduitRouteActions.POST,
        description: `Creates a new folder.`,
        bodyParams: {
          name: ConduitString.Required,
          container: ConduitString.Required,
          isPublic: ConduitBoolean.Optional,
        },
        queryParams: {
          ...(authzEnabled && { scope: { type: TYPE.String, required: false } }),
        },
      },
      new ConduitRouteReturnDefinition('CreateFolder', _StorageFolder.name),
      this.createFolder.bind(this),
    );
    this.routingManager.route(
      {
        path: '/folders/:id',
        errors: [errors.FOLDER_NOT_FOUND],
        action: ConduitRouteActions.DELETE,
        description: `Deletes a folder.`,
        urlParams: {
          id: { type: TYPE.String, required: true },
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
        errors: [errors.CONTAINER_ALREADY_EXISTS, errors.STORAGE_OPERATION_FAILED],
        action: ConduitRouteActions.POST,
        description: `Creates a new container.`,
        bodyParams: {
          name: ConduitString.Required,
          isPublic: ConduitBoolean.Optional,
        },
        queryParams: {
          ...(authzEnabled && { scope: { type: TYPE.String, required: false } }),
        },
      },
      new ConduitRouteReturnDefinition(_StorageContainer.name),
      this.createContainer.bind(this),
    );
    this.routingManager.route(
      {
        path: '/containers/:id',
        errors: [errors.CONTAINER_NOT_FOUND, errors.STORAGE_OPERATION_FAILED],
        action: ConduitRouteActions.DELETE,
        description: `Deletes a container.`,
        urlParams: {
          id: { type: TYPE.String, required: true },
        },
      },
      new ConduitRouteReturnDefinition('DeleteContainer', _StorageContainer.name),
      this.deleteContainer.bind(this),
    );
    this.routingManager.registerRoutes();
  }

  private async _createContainer(
    name: string,
    isPublic: boolean | undefined,
    scope?: string,
  ) {
    try {
      let container = await _StorageContainer.getInstance().findOne({
        name,
      });
      if (isNil(container)) {
        const exists = await this.fileHandlers.storage.containerExists(name);

        if (!exists) {
          await this.fileHandlers.storage.createContainer(name, isPublic);
        }
        container = await _StorageContainer.getInstance().create({
          name,
          isPublic,
        });
        await createContainerOwnerRelation(this.grpcSdk, container, scope);
      } else {
        throw new ModuleError(errors.CONTAINER_ALREADY_EXISTS);
      }
      return container;
    } catch (e) {
      rethrowGrpcOrInternal(e);
    }
  }
}
