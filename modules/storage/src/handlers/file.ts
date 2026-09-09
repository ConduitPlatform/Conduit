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
import {
  actorSubject,
  isAuthzEnabled,
  isDefaultContainer,
  rethrowGrpcOrInternal,
  resolveClientFolder,
  resolveFileId,
  resolveScope,
  resolveUserId,
} from '../authz/helpers.js';
import {
  assertFolderEditAccess,
  assertNoPersonalFolderSquat,
  findOrCreateFolders,
} from '../authz/folders.js';
import {
  createFileRelations,
  deleteAllRelationsSafe,
  updateFileRelations,
} from '../authz/relations.js';

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
    request: ParsedRouterRequest['request'],
    file?: File,
    container?: string,
  ) {
    const userId = resolveUserId(request);
    if (!userId) {
      throw new GrpcError(status.PERMISSION_DENIED, 'File access is not public');
    }
    if (!isAuthzEnabled()) {
      return;
    }

    const scope = resolveScope(request);
    if (action === 'create') {
      if (scope) {
        const allowed = await this.grpcSdk.authorization?.can({
          subject: `User:${userId}`,
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
      if (container && !isDefaultContainer(container)) {
        const containerDoc = await _StorageContainer.getInstance().findOne({
          name: container,
        });
        if (!containerDoc) {
          throw new GrpcError(status.NOT_FOUND, 'Container does not exist');
        }
        const allowed = await this.grpcSdk.authorization?.can({
          subject: scope ?? `User:${userId}`,
          actions: ['edit'],
          resource: `Container:${containerDoc._id}`,
        });
        if (!allowed || !allowed.allow) {
          throw new GrpcError(
            status.PERMISSION_DENIED,
            'You are not allowed to create files in this container',
          );
        }
      }
      return;
    }

    if (!file) {
      throw new GrpcError(status.NOT_FOUND, 'File does not exist');
    }
    const allowed = await this.grpcSdk.authorization?.can({
      subject: `User:${userId}`,
      actions: [action],
      resource: `File:${file._id}`,
    });
    if (!allowed || !allowed.allow) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        `You are not allowed to ${action} this file`,
      );
    }
  }

  async getFile(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const file = await File.getInstance().findOne({ _id: resolveFileId(call.request) });
    if (isNil(file)) {
      throw new GrpcError(status.NOT_FOUND, 'File does not exist');
    }

    if (!file.isPublic) {
      await this.fileAccessCheck('read', call.request, file);
    }
    return sanitizeFileForResponse(file);
  }

  async createFile(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { name, alias, data, container, mimeType, isPublic } = call.request.params;
    const userId = resolveUserId(call.request);
    if (!userId) {
      throw new GrpcError(status.PERMISSION_DENIED, 'File access is not public');
    }
    const usedContainer = await this.resolveClientContainer(container);
    await this.fileAccessCheck('create', call.request, undefined, usedContainer);
    const folder = resolveClientFolder(call.request.params.folder, userId);
    await this.prepareClientFolder(call, usedContainer, folder, isPublic);
    const validatedName = await validateName(name, folder, usedContainer);
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
      await createFileRelations(this.grpcSdk, file, {
        scope: resolveScope(call.request),
        userId,
      });
      return file;
    } catch (e) {
      rethrowGrpcOrInternal(e);
    }
  }

  async createFileUploadUrl(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { name, alias, container, size = 0, mimeType, isPublic } = call.request.params;
    const userId = resolveUserId(call.request);
    if (!userId) {
      throw new GrpcError(status.PERMISSION_DENIED, 'File access is not public');
    }
    const usedContainer = await this.resolveClientContainer(container);
    await this.fileAccessCheck('create', call.request, undefined, usedContainer);
    const folder = resolveClientFolder(call.request.params.folder, userId);
    await this.prepareClientFolder(call, usedContainer, folder, isPublic);
    const validatedName = await validateName(name, folder, usedContainer);
    try {
      const { file, url } = await _createFileUploadUrl(this.storageProvider, {
        container: usedContainer,
        folder,
        isPublic,
        name: validatedName,
        alias,
        size,
        mimeType,
      });
      await createFileRelations(this.grpcSdk, file, {
        scope: resolveScope(call.request),
        userId,
      });
      return { file, url };
    } catch (e) {
      rethrowGrpcOrInternal(e);
    }
  }

  async updateFileUploadUrl(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { alias, mimeType, size } = call.request.params;
    const found = await File.getInstance().findOne({ _id: resolveFileId(call.request) });
    if (isNil(found)) {
      throw new GrpcError(status.NOT_FOUND, 'File does not exist');
    }
    await this.fileAccessCheck('edit', call.request, found);
    const { name, folder, container } = await this.validateFilenameAndContainer(
      call,
      found,
    );
    try {
      const result = await _updateFileUploadUrl(this.storageProvider, found, {
        name,
        alias,
        folder,
        container,
        mimeType: mimeType ?? found.mimeType,
        size,
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
    await this.fileAccessCheck('edit', call.request, found);
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
      await this.fileAccessCheck('delete', call.request, found);
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
      const found = await File.getInstance().findOne({
        _id: resolveFileId(call.request),
      });
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
      await this.fileAccessCheck('read', call.request, found);
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
      await this.fileAccessCheck('read', call.request, file);
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

  private async resolveClientContainer(container?: string): Promise<string> {
    const config = ConfigController.getInstance().config;
    const name = isNil(container) ? config.defaultContainer : container;
    const found = await _StorageContainer.getInstance().findOne({ name });
    if (!found) {
      throw new GrpcError(status.NOT_FOUND, 'Container does not exist');
    }
    return name;
  }

  private async prepareClientFolder(
    call: ParsedRouterRequest,
    container: string,
    folder: string,
    isPublic?: boolean,
  ) {
    if (folder === '/') {
      return;
    }
    const userId = resolveUserId(call.request);
    if (!userId) {
      throw new GrpcError(status.PERMISSION_DENIED, 'File access is not public');
    }
    await assertNoPersonalFolderSquat(folder, userId, container);
    const subject = actorSubject(call.request);
    if (subject) {
      await assertFolderEditAccess(this.grpcSdk, container, folder, subject);
    }
    await findOrCreateFolders(this.grpcSdk, this.storageProvider, folder, container, {
      isPublic,
      scope: subject,
    });
  }

  private async validateFilenameAndContainer(call: ParsedRouterRequest, file: File) {
    const { name, folder, container } = call.request.params;
    const newName = name ?? file.name;
    const newContainer = container ?? file.container;
    if (newContainer !== file.container) {
      await this.resolveClientContainer(newContainer);
      await this.fileAccessCheck('create', call.request, undefined, newContainer);
    }
    const newFolder = isNil(folder) ? file.folder : normalizeFolderPath(folder);
    if (newFolder !== file.folder && newFolder !== '/') {
      await this.prepareClientFolder(call, newContainer, newFolder, file.isPublic);
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
