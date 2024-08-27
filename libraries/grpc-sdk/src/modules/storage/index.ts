import { ConduitModule } from '../../classes/index.js';
import {
  DeleteFileResponse,
  FileByUrlResponse,
  FileResponse,
  GetFileDataResponse,
  GetFileUrlResponse,
  StorageDefinition,
} from '../../protoUtils/storage.js';
import {
  GetFileParamEnum,
  GetFileParams,
  GetFileUrlParamEnum,
  GetFileUrlParams,
  GetFileDataParamEnum,
  GetFileDataParams,
  CreateFileParamEnum,
  CreateFileParams,
  UpdateFileParamEnum,
  UpdateFileParams,
  DeleteFileParamEnum,
  DeleteFileParams,
  CreateFileByUrlParamEnum,
  CreateFileByUrlParams,
  UpdateFileByUrlParamEnum,
  UpdateFileByUrlParams,
} from './types';
import { normalizeParams } from '../../utilities/normalizeParams';

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

  getFile(params: { id: string; userId?: string; scope?: string }): Promise<FileResponse>;

  getFile(...params: GetFileParams): Promise<FileResponse> {
    const obj = normalizeParams(params, Object.keys(GetFileParamEnum));
    return this.client!.getFile(obj);
  }

  getFileUrl(id: string, userId?: string, scope?: string): Promise<GetFileUrlResponse>;

  getFileUrl(params: {
    id: string;
    userId?: string;
    scope?: string;
  }): Promise<GetFileUrlResponse>;

  getFileUrl(...params: GetFileUrlParams): Promise<GetFileUrlResponse> {
    const obj = normalizeParams(params, Object.keys(GetFileUrlParamEnum));
    return this.client!.getFileUrl(obj);
  }

  getFileData(id: string, userId?: string, scope?: string): Promise<GetFileDataResponse>;

  getFileData(params: {
    id: string;
    userId?: string;
    scope?: string;
  }): Promise<GetFileDataResponse>;

  getFileData(...params: GetFileDataParams): Promise<GetFileDataResponse> {
    const obj = normalizeParams(params, Object.keys(GetFileDataParamEnum));
    return this.client!.getFileData(obj);
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

  createFile(params: {
    name: string | undefined;
    data: string;
    folder?: string;
    container?: string;
    mimeType?: string;
    isPublic?: boolean;
    userId?: string;
    scope?: string;
    alias?: string;
  }): Promise<FileResponse>;

  createFile(...params: CreateFileParams): Promise<FileResponse> {
    const obj = normalizeParams(params, Object.keys(CreateFileParamEnum));
    return this.client!.createFile({
      ...obj,
      isPublic: obj.isPublic ?? false,
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

  updateFile(params: {
    id: string;
    data: string;
    name?: string;
    folder?: string;
    container?: string;
    mimeType?: string;
    userId?: string;
    scope?: string;
    alias?: string;
  }): Promise<FileResponse>;

  updateFile(...params: UpdateFileParams): Promise<FileResponse> {
    const obj = normalizeParams(params, Object.keys(UpdateFileParamEnum));
    return this.client!.updateFile(obj);
  }

  deleteFile(id: string, userId?: string, scope?: string): Promise<DeleteFileResponse>;

  deleteFile(params: {
    id: string;
    userId?: string;
    scope?: string;
  }): Promise<DeleteFileResponse>;

  deleteFile(...params: DeleteFileParams): Promise<DeleteFileResponse> {
    const obj = normalizeParams(params, Object.keys(DeleteFileParamEnum));
    return this.client!.deleteFile(obj);
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

  createFileByUrl(params: {
    name: string | undefined;
    folder?: string;
    container?: string;
    mimeType?: string;
    size?: number;
    isPublic?: boolean;
    userId?: string;
    scope?: string;
    alias?: string;
  }): Promise<FileByUrlResponse>;

  createFileByUrl(...params: CreateFileByUrlParams): Promise<FileByUrlResponse> {
    const obj = normalizeParams(params, Object.keys(CreateFileByUrlParamEnum));
    return this.client!.createFileByUrl({
      ...obj,
      isPublic: obj.isPublic ?? false,
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

  updateFileByUrl(params: {
    id: string;
    name?: string;
    folder?: string;
    container?: string;
    mimeType?: string;
    size?: number;
    userId?: string;
    scope?: string;
    alias?: string;
  }): Promise<FileByUrlResponse>;

  updateFileByUrl(...params: UpdateFileByUrlParams): Promise<FileByUrlResponse> {
    const obj = normalizeParams(params, Object.keys(UpdateFileByUrlParamEnum));
    return this.client!.updateFileByUrl(obj);
  }
}
