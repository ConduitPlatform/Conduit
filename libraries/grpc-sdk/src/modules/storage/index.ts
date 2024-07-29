import { ConduitModule } from '../../classes/index.js';
import {
  DeleteFileResponse,
  FileResponse,
  GetFileDataResponse,
  GetFileUrlResponse,
  StorageDefinition,
} from '../../protoUtils/storage.js';

export class Storage extends ConduitModule<typeof StorageDefinition> {
  constructor(
    private readonly moduleName: string,
    url: string,
    grpcToken?: string,
  ) {
    super(moduleName, 'storage', url, grpcToken);
    this.initializeClient(StorageDefinition);
  }

  getFile(id: string, userId?: string, scope?: string): Promise<FileResponse> {
    return this.client!.getFile({ id, userId, scope });
  }

  getFileUrl(id: string, userId?: string, scope?: string): Promise<GetFileUrlResponse> {
    return this.client!.getFileUrl({ id, userId, scope });
  }

  getFileData(id: string, userId?: string, scope?: string): Promise<GetFileDataResponse> {
    return this.client!.getFileData({ id, userId, scope });
  }

  createFile(
    name: string | undefined,
    data: string,
    folder?: string,
    container?: string,
    mimeType?: string,
    isPublic: boolean = false,
    userId?: string,
    scope?: string,
    alias?: string,
  ): Promise<FileResponse> {
    return this.client!.createFile({
      name,
      mimeType,
      data,
      folder,
      isPublic,
      container,
      userId,
      scope,
      alias,
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
  ): Promise<FileResponse> {
    return this.client!.updateFile({
      name,
      mimeType,
      data,
      folder,
      id,
      container,
      userId,
      scope,
      alias,
    });
  }

  deleteFile(id: string, userId?: string, scope?: string): Promise<DeleteFileResponse> {
    return this.client!.deleteFile({ id, userId, scope });
  }

  createFileByUrl(
    name: string | undefined,
    folder?: string,
    container?: string,
    mimeType?: string,
    size?: number,
    isPublic: boolean = false,
    userId?: string,
    scope?: string,
    alias?: string,
  ) {
    return this.client!.createFileByUrl({
      name,
      mimeType,
      folder,
      container,
      size,
      isPublic,
      userId,
      scope,
      alias,
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
  ) {
    return this.client!.updateFileByUrl({
      id,
      name,
      folder,
      container,
      mimeType,
      size,
      userId,
      scope,
      alias,
    });
  }
}
