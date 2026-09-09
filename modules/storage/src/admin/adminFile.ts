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
import { IStorageProvider, UrlOptions } from '../interfaces/index.js';
import {
  _createFileUploadUrl,
  _updateFile,
  _updateFileUploadUrl,
  applyCdnHost,
  normalizeFolderPath,
  resolvePublicFileAccessUrl,
  sanitizeFileForResponse,
  storeNewFile,
  validateName,
} from '../utils/index.js';
import { rethrowGrpcOrInternal, resolveFileId, resolveScope } from '../authz/helpers.js';
import { findOrCreateFolders } from '../authz/folders.js';
import {
  createFileRelations,
  deleteAllRelationsSafe,
  updateFileRelations,
} from '../authz/relations.js';

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

    return sanitizeFileForResponse(file);
  }

  async createFile(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { name, alias, data, container, mimeType, isPublic } = call.request.params;
    const scope = resolveScope(call.request);
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
        {
          isPublic,
          scope,
        },
      );
    }
    const validatedName = await validateName(name, folder, usedContainer);
    if (!isString(data)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid data provided');
    }

    try {
      const file = await storeNewFile(this.storageProvider, {
        name: validatedName,
        alias,
        data,
        container: usedContainer,
        folder,
        isPublic,
        mimeType,
      });
      await createFileRelations(this.grpcSdk, file, { scope });
      return file;
    } catch (e) {
      rethrowGrpcOrInternal(e);
    }
  }

  async createFileUploadUrl(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { name, alias, container, size = 0, mimeType, isPublic } = call.request.params;
    const scope = resolveScope(call.request);
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
        {
          isPublic,
          scope,
        },
      );
    }
    const validatedName = await validateName(name, folder, usedContainer);

    try {
      const result = await _createFileUploadUrl(this.storageProvider, {
        container: usedContainer,
        folder,
        isPublic,
        name: validatedName,
        alias,
        size,
        mimeType,
      });
      await createFileRelations(this.grpcSdk, result.file, { scope });
      return result;
    } catch (e) {
      rethrowGrpcOrInternal(e);
    }
  }

  async updateFileUploadUrl(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const found = await File.getInstance().findOne({ _id: resolveFileId(call.request) });
    if (isNil(found)) {
      throw new GrpcError(status.NOT_FOUND, 'File does not exist');
    }
    const { name, folder, container } = await this.validateFilenameAndContainer(
      call,
      found,
    );
    try {
      const result = await _updateFileUploadUrl(this.storageProvider, found, {
        name,
        alias: call.request.params.alias,
        folder,
        container,
        mimeType: call.request.params.mimeType ?? found.mimeType,
        size: call.request.params.size,
      });
      await updateFileRelations(this.grpcSdk, found, result.file, {
        scope: resolveScope(call.request),
      });
      return result;
    } catch (e) {
      rethrowGrpcOrInternal(e);
    }
  }

  async updateFile(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { alias, data, mimeType } = call.request.params;
    const found = await File.getInstance().findOne({ _id: resolveFileId(call.request) });
    if (isNil(found)) {
      throw new GrpcError(status.NOT_FOUND, 'File does not exist');
    }
    const { name, folder, container } = await this.validateFilenameAndContainer(
      call,
      found,
    );
    try {
      const updated = (await _updateFile(this.storageProvider, found, {
        name,
        alias,
        folder,
        container,
        data: Buffer.from(data, 'base64'),
        mimeType: mimeType ?? found.mimeType,
      })) as File;
      await updateFileRelations(this.grpcSdk, found, updated, {
        scope: resolveScope(call.request),
      });
      return updated;
    } catch (e) {
      rethrowGrpcOrInternal(e);
    }
  }

  async deleteFile(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const id = resolveFileId(call.request);
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
      await deleteAllRelationsSafe(this.grpcSdk, { resource: `File:${id}` });
      return { success: true };
    } catch (e) {
      rethrowGrpcOrInternal(e);
    }
  }

  async getFileUrl(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    try {
      const found = await File.getInstance().findOne({ _id: call.request.params.id });
      if (isNil(found)) {
        throw new GrpcError(status.NOT_FOUND, 'File does not exist');
      }
      if (found.isPublic) {
        const url = await resolvePublicFileAccessUrl(this.storageProvider, found);
        if (!call.request.params.redirect) {
          return { result: url };
        }
        return { redirect: url };
      }
      const options: UrlOptions = {
        download: call.request.params.download ?? false,
        fileName: found.alias ?? found.name,
      };
      const rawUrl = await this.storageProvider
        .container(found.container)
        .getSignedUrl((found.folder === '/' ? '' : found.folder) + found.name, options);
      const url = applyCdnHost(rawUrl, found.container);

      if (!call.request.params.redirect) {
        return { result: url };
      }
      return { redirect: url };
    } catch (e) {
      rethrowGrpcOrInternal(e);
    }
  }

  async getFileData(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const id = resolveFileId(call.request);
    if (!isString(id)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'The provided id is invalid');
    }
    try {
      const file = await File.getInstance().findOne({ _id: id });
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
      rethrowGrpcOrInternal(e);
    }
  }

  private async findOrCreateContainer(
    container: string,
    isPublic?: boolean,
  ): Promise<string> {
    const config = ConfigController.getInstance().config;
    const found = await _StorageContainer.getInstance().findOne({
      name: container,
    });
    if (!found) {
      if (!config.allowContainerCreation) {
        throw new GrpcError(
          status.PERMISSION_DENIED,
          'Container creation is not allowed!',
        );
      }
      const exists = await this.storageProvider.containerExists(container);
      if (!exists) {
        await this.storageProvider.createContainer(container, isPublic);
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
        {
          isPublic: file.isPublic,
          scope: resolveScope(call.request),
        },
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
