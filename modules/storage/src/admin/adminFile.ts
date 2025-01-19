import {
  ConduitGrpcSdk,
  DatabaseProvider,
  GrpcError,
  ParsedRouterRequest,
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
  deepPathHandler,
  findOrCreateFolders,
  normalizeFolderPath,
  storeNewFile,
  validateName,
} from '../utils/index.js';

export class AdminFileHandlers {
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

  async getFile(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const file = await File.getInstance().findOne({ _id: call.request.params.id });
    if (isNil(file)) {
      throw new GrpcError(status.NOT_FOUND, 'File does not exist');
    }
    return file;
  }

  async createFile(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { name, alias, data, container, mimeType, isPublic, scope } =
      call.request.params;
    const config = ConfigController.getInstance().config;

    const folder = normalizeFolderPath(call.request.params.folder);
    const usedContainer = isNil(container)
      ? config.defaultContainer
      : await this.findOrCreateContainer(container, isPublic);
    if (folder !== '/') {
      await findOrCreateFolders(
        this.grpcSdk,
        this.storageProvider,
        folder,
        usedContainer,
        isPublic,
        scope,
      );
    }
    const validatedName = await validateName(name, folder, usedContainer);
    if (!isString(data)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid data provided');
    }

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
        scope,
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

    const folder = normalizeFolderPath(call.request.params.folder);
    const config = ConfigController.getInstance().config;
    const usedContainer = isNil(container)
      ? config.defaultContainer
      : await this.findOrCreateContainer(container, isPublic);
    if (folder !== '/') {
      await findOrCreateFolders(
        this.grpcSdk,
        this.storageProvider,
        folder,
        usedContainer,
        isPublic,
        scope,
      );
    }
    const validatedName = await validateName(name, folder, usedContainer);

    try {
      return await _createFileUploadUrl(
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
        scope,
      );
    } catch (e) {
      throw new GrpcError(
        status.INTERNAL,
        (e as Error).message ?? 'Something went wrong',
      );
    }
  }

  async updateFileUploadUrl(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, alias, mimeType, size, scope } = call.request.params;
    const found = await File.getInstance().findOne({ _id: id });
    if (isNil(found)) {
      throw new GrpcError(status.NOT_FOUND, 'File does not exist');
    }
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
        scope,
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
    const found = await File.getInstance().findOne({ _id: id });
    if (isNil(found)) {
      throw new GrpcError(status.NOT_FOUND, 'File does not exist');
    }
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
        scope,
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
    if (!isString(id)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'The provided id is invalid');
    }
    try {
      const found = await File.getInstance().findOne({ _id: id });
      if (isNil(found)) {
        throw new GrpcError(status.NOT_FOUND, 'File does not exist');
      }
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

  private async findOrCreateContainer(
    container: string,
    isPublic?: boolean,
  ): Promise<string> {
    const found = await _StorageContainer.getInstance().findOne({
      name: container,
    });
    if (!found) {
      const exists = await this.storageProvider.containerExists(container);
      if (!exists) {
        await this.storageProvider.createContainer(container);
      }
      await _StorageContainer.getInstance().create({
        name: container,
        isPublic,
      });
    }
    return container;
  }

  private async validateFilenameAndContainer(call: ParsedRouterRequest, file: File) {
    const { name, folder, container } = call.request.params;
    const newName = name ?? file.name;
    const newContainer = container ?? file.container;
    if (newContainer !== file.container) {
      await this.findOrCreateContainer(newContainer);
    }
    const newFolder = isNil(folder) ? file.folder : normalizeFolderPath(folder);
    if (newFolder !== file.folder && newFolder !== '/') {
      await findOrCreateFolders(
        this.grpcSdk,
        this.storageProvider,
        newFolder,
        newContainer,
        file.isPublic,
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
