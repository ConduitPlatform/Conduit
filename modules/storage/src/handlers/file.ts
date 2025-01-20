import {
  ConduitGrpcSdk,
  DatabaseProvider,
  GrpcError,
  ParsedRouterRequest,
  Query,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { isNil, isString } from 'lodash-es';
import { _StorageContainer, _StorageFolder, File } from '../models/index.js';
import { IStorageProvider } from '../interfaces/index.js';
import {
  _createFileUploadUrl,
  _updateFile,
  _updateFileUploadUrl,
  findOrCreateFolders,
  getNestedPaths,
  normalizeFolderPath,
  storeNewFile,
  validateName,
} from '../utils/index.js';

export class FileHandlers {
  private readonly database: DatabaseProvider;
  private storageProvider: IStorageProvider;

  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    storageProvider: IStorageProvider,
  ) {
    this.database = this.grpcSdk.databaseProvider!;
    _StorageContainer.getInstance(this.database);
    _StorageFolder.getInstance(this.database);
    File.getInstance(this.database);
    this.storageProvider = storageProvider;
  }

  get storage() {
    return this.storageProvider;
  }

  updateProvider(storageProvider: IStorageProvider) {
    this.storageProvider = storageProvider;
  }

  async fileAccessCheck(
    action: 'read' | 'create' | 'edit' | 'delete',
    userId?: string,
    scope?: string,
    file?: File,
    container?: string,
  ) {
    if (!userId) {
      throw new GrpcError(status.PERMISSION_DENIED, 'File access is not public');
    }
    if (!ConfigController.getInstance().config.authorization.enabled) {
      return;
    }

    if (action === 'create') {
      if (scope) {
        const allowed = await this.grpcSdk.authorization?.can({
          subject: 'User:' + userId,
          actions: ['edit'],
          resource: scope,
        });
        if (!allowed || !allowed.allow) {
          throw new GrpcError(
            status.PERMISSION_DENIED,
            'You are not allowed to create files in this scope',
          );
        }
      }
      const defaultContainer = ConfigController.getInstance().config.defaultContainer;
      if (container !== defaultContainer) {
        const containerDoc = await _StorageContainer
          .getInstance()
          .findOne({ name: container });
        const allowed = await this.grpcSdk.authorization?.can({
          subject: scope ?? 'User:' + userId,
          actions: ['edit'],
          resource: 'Container:' + containerDoc?._id,
        });
        if (!allowed || !allowed.allow) {
          throw new GrpcError(
            status.PERMISSION_DENIED,
            'You are not allowed to create files in this container',
          );
        }
      }
    } else {
      const allowed = await this.grpcSdk.authorization?.can({
        subject: 'User:' + userId,
        actions: [action],
        resource: `File:${file!._id}`,
      });
      if (!allowed || !allowed.allow) {
        throw new GrpcError(
          status.PERMISSION_DENIED,
          `You are not allowed to ${action} this file`,
        );
      }
    }
  }

  /* Checks if user can create-update file in provided folder */
  async folderAccessEdit(container: string, folder: string, scope: string) {
    if (!ConfigController.getInstance().config.authorization.enabled) {
      return;
    }
    const folderDoc = await _StorageFolder.getInstance().findOne({
      name: folder,
      container,
    });
    if (folderDoc) {
      const allowed = await this.grpcSdk.authorization?.can({
        subject: scope,
        actions: ['edit'],
        resource: 'Folder:' + folderDoc._id,
      });
      if (!allowed || !allowed.allow) {
        throw new GrpcError(
          status.PERMISSION_DENIED,
          'You are not allowed to edit files in folder ' + folderDoc.name,
        );
      }
      return;
    } else {
      // Check previous folders
      const nestedPaths = getNestedPaths(folder);
      for (let i = nestedPaths.length - 2; i >= 0; i--) {
        const prevFolder = await _StorageFolder.getInstance().findOne({
          name: nestedPaths[i],
          container,
        });
        if (!prevFolder) {
          continue;
        }
        if (prevFolder) {
          const allowed = await this.grpcSdk.authorization?.can({
            subject: scope,
            actions: ['edit'],
            resource: 'Folder:' + prevFolder._id,
          });
          if (!allowed || !allowed.allow) {
            throw new GrpcError(
              status.PERMISSION_DENIED,
              'You are not allowed to edit files in folder' + prevFolder.name,
            );
          }
          return;
        }
      }
    }
  }

  async getFile(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const file = await File.getInstance().findOne({ _id: call.request.params.id });
    if (isNil(file)) {
      throw new GrpcError(status.NOT_FOUND, 'File does not exist');
    }

    if (!file.isPublic) {
      await this.fileAccessCheck(
        'read',
        call.request.context.user._id,
        call.request.context.scope,
        file,
      );
    }
    return file;
  }

  async getFiles(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { search, folder, container, skip, limit, sort, scope } =
      call.request.queryParams;
    const { user } = call.request.context;
    const authzEnabled = ConfigController.getInstance().config.authorization.enabled;
    const query: Query<File> = {
      $and: [{ container }],
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
    if (!user) {
      return await File.getInstance().findMany(query, undefined, skip, limit, sort);
    }
    return await File.getInstance().findMany(
      query,
      undefined,
      skip,
      limit,
      sort,
      undefined,
      authzEnabled ? user._id : undefined,
      authzEnabled ? scope : undefined,
    );
  }

  async createFile(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { name, alias, data, container, mimeType, isPublic, scope } =
      call.request.params;
    const { user } = call.request.context;

    const config = ConfigController.getInstance().config;
    const usedContainer = isNil(container)
      ? config.defaultContainer
      : await this.findContainer(container);
    await this.fileAccessCheck('create', user, scope, undefined, usedContainer);

    const folder = normalizeFolderPath(call.request.params.folder ?? 'cnd_' + user._id);
    if (folder !== '/') {
      await this.folderAccessEdit(usedContainer, folder, scope ?? 'User:' + user._id);
      await findOrCreateFolders(
        this.grpcSdk,
        this.storageProvider,
        folder,
        usedContainer,
        isPublic,
        scope ?? 'User:' + user._id,
      );
    }
    const validatedName = await validateName(name, folder, usedContainer);

    try {
      return await storeNewFile(
        this.grpcSdk,
        this.storageProvider,
        {
          name: validatedName,
          alias,
          data,
          container: usedContainer,
          folder,
          isPublic,
          mimeType,
        },
        scope ?? 'User:' + user._id,
      );
    } catch (e) {
      throw new GrpcError(
        status.INTERNAL,
        (e as Error).message ?? 'Something went wrong',
      );
    }
  }

  async createFileUploadUrl(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const {
      name,
      alias,
      container,
      size = 0,
      mimeType,
      isPublic,
      scope,
    } = call.request.params;
    const { user } = call.request.context;

    const config = ConfigController.getInstance().config;
    const usedContainer = isNil(container)
      ? config.defaultContainer
      : await this.findContainer(container);
    await this.fileAccessCheck('create', user, scope, undefined, usedContainer);

    const folder = normalizeFolderPath(call.request.params.folder ?? 'cnd_' + user._id);
    if (folder !== '/') {
      await this.folderAccessEdit(usedContainer, folder, scope ?? 'User:' + user._id);
      await findOrCreateFolders(
        this.grpcSdk,
        this.storageProvider,
        folder,
        usedContainer,
        isPublic,
        scope ?? 'User:' + user._id,
      );
    }
    const validatedName = await validateName(name, folder, usedContainer);

    try {
      const { file, url } = await _createFileUploadUrl(
        this.grpcSdk,
        this.storageProvider,
        {
          container: usedContainer,
          folder,
          isPublic,
          name: validatedName,
          alias,
          size,
          mimeType,
        },
        scope ?? 'User:' + user._id,
      );
      return { file, url };
    } catch (e) {
      throw new GrpcError(
        status.INTERNAL,
        (e as Error).message ?? 'Something went wrong',
      );
    }
  }

  async updateFileUploadUrl(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, alias, mimeType, size, scope } = call.request.params;
    const { user } = call.request.context;

    const found = await File.getInstance().findOne({ _id: id });
    if (isNil(found)) {
      throw new GrpcError(status.NOT_FOUND, 'File does not exist');
    }
    await this.fileAccessCheck('edit', user._id, scope, found);
    const { name, folder, container } = await this.validateFilenameAndContainer(
      call,
      found,
    );
    try {
      return await _updateFileUploadUrl(
        this.grpcSdk,
        this.storageProvider,
        found,
        {
          name,
          alias,
          folder,
          container,
          mimeType: mimeType ?? found.mimeType,
          size,
        },
        scope ?? 'User:' + user._id,
      );
    } catch (e) {
      throw new GrpcError(
        status.INTERNAL,
        (e as Error).message ?? 'Something went wrong',
      );
    }
  }

  async updateFile(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, alias, data, mimeType, scope } = call.request.params;
    const { user } = call.request.context;

    const found = await File.getInstance().findOne({ _id: id });
    if (isNil(found)) {
      throw new GrpcError(status.NOT_FOUND, 'File does not exist');
    }
    await this.fileAccessCheck('edit', user._id, scope, found);
    const { name, folder, container } = await this.validateFilenameAndContainer(
      call,
      found,
    );
    try {
      return await _updateFile(
        this.grpcSdk,
        this.storageProvider,
        found,
        {
          name,
          alias,
          folder,
          container,
          data: Buffer.from(data, 'base64'),
          mimeType: mimeType ?? found.mimeType,
        },
        scope ?? 'User:' + user._id,
      );
    } catch (e) {
      throw new GrpcError(
        status.INTERNAL,
        (e as Error).message ?? 'Something went wrong!',
      );
    }
  }

  async deleteFile(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id } = call.request.urlParams;
    const { scope } = call.request.queryParams;
    if (!isString(id)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'The provided id is invalid');
    }
    try {
      const found = await File.getInstance().findOne({ _id: id });
      if (isNil(found)) {
        throw new GrpcError(status.NOT_FOUND, 'File does not exist');
      }
      await this.fileAccessCheck('delete', id, scope, found);

      const success = await this.storageProvider
        .container(found.container)
        .delete((found.folder === '/' ? '' : found.folder) + found.name);
      if (!success) {
        throw new GrpcError(status.INTERNAL, 'File could not be deleted');
      }
      await File.getInstance().deleteOne({ _id: id });
      ConduitGrpcSdk.Metrics?.decrement('files_total');
      ConduitGrpcSdk.Metrics?.decrement('storage_size_bytes_total', found.size);

      if (ConfigController.getInstance().config.authorization.enabled) {
        await this.grpcSdk.authorization
          ?.deleteAllRelations({ resource: 'File:' + id })
          .catch((e: Error) => {
            if (!e.message.includes('No relations found')) {
              throw e;
            }
          });
      }
      return { success: true };
    } catch (e) {
      throw new GrpcError(
        status.INTERNAL,
        (e as Error).message ?? 'Something went wrong!',
      );
    }
  }

  async getFileUrl(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    try {
      const found = await File.getInstance().findOne({ _id: call.request.params.id });
      if (isNil(found)) {
        throw new GrpcError(status.NOT_FOUND, 'File does not exist');
      }
      if (found.isPublic) {
        if (!call.request.params.redirect) {
          return { result: found.url };
        }
        return { redirect: found.url };
      }
      await this.fileAccessCheck(
        'read',
        call.request.context.user._id,
        call.request.queryParams.scope,
        found,
      );
      const url = await this.storageProvider
        .container(found.container)
        .getSignedUrl((found.folder === '/' ? '' : found.folder) + found.name);

      if (!call.request.params.redirect) {
        return { result: url };
      }
      return { redirect: url };
    } catch (e) {
      throw new GrpcError(
        status.INTERNAL,
        (e as Error).message ?? 'Something went wrong!',
      );
    }
  }

  async getFileData(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    if (!isString(call.request.params.id)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'The provided id is invalid');
    }
    try {
      const file = await File.getInstance().findOne({ _id: call.request.params.id });
      if (isNil(file)) {
        throw new GrpcError(status.NOT_FOUND, 'File does not exist');
      }
      await this.fileAccessCheck(
        'read',
        call.request.context.user._id,
        call.request.queryParams.scope,
        file,
      );
      let data: Buffer;
      const result = await this.storageProvider
        .container(file.container)
        .get(
          file.folder ? (file.folder === '/' ? '' : file.folder) + file.name : file.name,
        );
      if (result instanceof Error) {
        throw result;
      } else {
        data = result;
      }
      return { data: data.toString('base64') };
    } catch (e) {
      throw new GrpcError(
        status.INTERNAL,
        (e as Error).message ?? 'Something went wrong!',
      );
    }
  }

  private async findContainer(container: string): Promise<string> {
    const found = await _StorageContainer.getInstance().findOne({
      name: container,
    });
    if (!found) {
      throw new GrpcError(status.NOT_FOUND, 'Container does not exist');
    }
    return container;
  }

  private async validateFilenameAndContainer(call: ParsedRouterRequest, file: File) {
    const { name, folder, container, scope } = call.request.params;
    const newName = name ?? file.name;
    const newContainer = container ?? file.container;
    if (newContainer !== file.container) {
      await this.findContainer(newContainer);
    }
    const newFolder = isNil(folder) ? file.folder : normalizeFolderPath(folder);
    if (newFolder !== file.folder && newFolder !== '/') {
      await this.folderAccessEdit(
        newContainer,
        newFolder,
        scope ?? 'User:' + call.request.context.user._id,
      );
      await findOrCreateFolders(
        this.grpcSdk,
        this.storageProvider,
        newFolder,
        newContainer,
        file.isPublic,
        scope ?? 'User:' + call.request.context.user._id,
      );
    }
    const isDataUpdate =
      newName === file.name &&
      newFolder === file.folder &&
      newContainer === file.container;
    const exists = await File.getInstance().findOne({
      name: newName,
      container: newContainer,
      folder: newFolder,
    });
    if (!isDataUpdate && !isNil(exists)) {
      throw new GrpcError(status.ALREADY_EXISTS, 'File already exists');
    }
    return {
      name: newName,
      folder: newFolder,
      container: newContainer,
    };
  }
}
