import { ConduitModule } from '../../classes/index.js';
import {
  DeleteFileResponse,
  FileByUrlResponse,
  FileResponse,
  GetFileDataResponse,
  GetFileUrlResponse,
  StorageDefinition,
} from '../../protoUtils/storage.js';
import { AuthzOptions } from '../../types';
import { normalizeAuthzOptions } from '../../utilities/normalizeOptions.js';
import {
  CreateFileByURLOptions,
  CreateFileOptions,
  UpdateFileByURLOptions,
  UpdateFileOptions,
} from './types';
import { isNil } from 'lodash-es';

export class Storage extends ConduitModule<typeof StorageDefinition> {
  constructor(
    private readonly moduleName: string,
    url: string,
    grpcToken?: string,
  ) {
    super(moduleName, 'storage', url, grpcToken);
    this.initializeClient(StorageDefinition);
  }

  getFile(id: string, userId?: string, scope?: string): Promise<FileResponse>;

  getFile(id: string, options?: AuthzOptions): Promise<FileResponse>;

  getFile(
    id: string,
    userIdOrOptions?: string | AuthzOptions,
    scope?: string,
  ): Promise<FileResponse> {
    const options = normalizeAuthzOptions(userIdOrOptions, scope);
    return this.client!.getFile({ id, ...options });
  }

  getFileUrl(id: string, userId?: string, scope?: string): Promise<GetFileUrlResponse>;

  getFileUrl(id: string, options?: AuthzOptions): Promise<GetFileUrlResponse>;

  getFileUrl(
    id: string,
    userIdOrOptions?: string | AuthzOptions,
    scope?: string,
  ): Promise<GetFileUrlResponse> {
    const options = normalizeAuthzOptions(userIdOrOptions, scope);
    return this.client!.getFileUrl({ id, ...options });
  }

  getFileData(id: string, userId?: string, scope?: string): Promise<GetFileDataResponse>;

  getFileData(id: string, options?: AuthzOptions): Promise<GetFileDataResponse>;

  getFileData(
    id: string,
    userIdOrOptions?: string | AuthzOptions,
    scope?: string,
  ): Promise<GetFileDataResponse> {
    const options = normalizeAuthzOptions(userIdOrOptions, scope);
    return this.client!.getFileData({ id, ...options });
  }

  createFile(
    name: string | undefined,
    data: string,
    folder?: string,
    container?: string,
    mimeType?: string,
    isPublic?: boolean,
    userId?: string,
    scope?: string,
    alias?: string,
  ): Promise<FileResponse>;

  createFile(
    name: string | undefined,
    data: string,
    options?: CreateFileOptions,
  ): Promise<FileResponse>;

  createFile(
    name: string | undefined,
    data: string,
    folderOrOptions?: string | CreateFileOptions,
    container?: string,
    mimeType?: string,
    isPublic?: boolean,
    userId?: string,
    scope?: string,
    alias?: string,
  ): Promise<FileResponse> {
    let options: CreateFileOptions;
    if (typeof folderOrOptions === 'string' || isNil(folderOrOptions)) {
      options = {
        folder: folderOrOptions,
        container,
        mimeType,
        isPublic,
        userId,
        scope,
        alias,
      };
    } else {
      options = folderOrOptions;
    }
    return this.client!.createFile({
      name,
      data,
      ...options,
      isPublic: options.isPublic ?? false,
    });
  }

  updateFile(
    id: string,
    data: string,
    name?: string,
    folder?: string,
    container?: string,
    mimeType?: string,
    userId?: string,
    scope?: string,
    alias?: string,
  ): Promise<FileResponse>;

  updateFile(
    id: string,
    data: string,
    options?: UpdateFileOptions,
  ): Promise<FileResponse>;

  updateFile(
    id: string,
    data: string,
    nameOrOptions?: string | UpdateFileOptions,
    folder?: string,
    container?: string,
    mimeType?: string,
    userId?: string,
    scope?: string,
    alias?: string,
  ): Promise<FileResponse> {
    let options: UpdateFileOptions;
    if (typeof nameOrOptions === 'string' || isNil(nameOrOptions)) {
      options = {
        name: nameOrOptions,
        folder,
        container,
        mimeType,
        userId,
        scope,
        alias,
      };
    } else {
      options = nameOrOptions;
    }
    return this.client!.updateFile({
      id,
      data,
      ...options,
    });
  }

  deleteFile(id: string, userId?: string, scope?: string): Promise<DeleteFileResponse>;

  deleteFile(id: string, options?: AuthzOptions): Promise<DeleteFileResponse>;

  deleteFile(
    id: string,
    userIdOrOptions?: string | AuthzOptions,
    scope?: string,
  ): Promise<DeleteFileResponse> {
    const options = normalizeAuthzOptions(userIdOrOptions, scope);
    return this.client!.deleteFile({ id, ...options });
  }

  createFileByUrl(
    name: string | undefined,
    folder?: string,
    container?: string,
    mimeType?: string,
    size?: number,
    isPublic?: boolean,
    userId?: string,
    scope?: string,
    alias?: string,
  ): Promise<FileByUrlResponse>;

  createFileByUrl(
    name: string | undefined,
    options?: CreateFileByURLOptions,
  ): Promise<FileByUrlResponse>;

  createFileByUrl(
    name: string | undefined,
    folderOrOptions?: string | CreateFileByURLOptions,
    container?: string,
    mimeType?: string,
    size?: number,
    isPublic?: boolean,
    userId?: string,
    scope?: string,
    alias?: string,
  ): Promise<FileByUrlResponse> {
    let options: CreateFileByURLOptions;
    if (typeof folderOrOptions === 'string' || isNil(folderOrOptions)) {
      options = {
        folder: folderOrOptions,
        container,
        mimeType,
        size,
        isPublic,
        userId,
        scope,
        alias,
      };
    } else {
      options = folderOrOptions;
    }
    return this.client!.createFileByUrl({
      name,
      ...options,
      isPublic: options.isPublic ?? false,
    });
  }

  updateFileByUrl(
    id: string,
    name?: string,
    folder?: string,
    container?: string,
    mimeType?: string,
    size?: number,
    userId?: string,
    scope?: string,
    alias?: string,
  ): Promise<FileByUrlResponse>;

  updateFileByUrl(
    id: string,
    options?: UpdateFileByURLOptions,
  ): Promise<FileByUrlResponse>;

  updateFileByUrl(
    id: string,
    nameOrOptions?: string | UpdateFileByURLOptions,
    folder?: string,
    container?: string,
    mimeType?: string,
    size?: number,
    userId?: string,
    scope?: string,
    alias?: string,
  ): Promise<FileByUrlResponse> {
    let options: UpdateFileByURLOptions;
    if (typeof nameOrOptions === 'string' || isNil(nameOrOptions)) {
      options = {
        name: nameOrOptions,
        folder,
        container,
        mimeType,
        size,
        userId,
        scope,
        alias,
      };
    } else {
      options = nameOrOptions;
    }
    return this.client!.updateFileByUrl({ id, ...options });
  }
}
