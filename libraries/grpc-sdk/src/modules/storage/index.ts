import { ConduitModule } from '../../classes/ConduitModule';
import {
  DeleteFileResponse,
  FileResponse,
  GetFileDataResponse,
  StorageDefinition,
} from '../../protoUtils/storage';

export class Storage extends ConduitModule<typeof StorageDefinition> {
  constructor(private readonly moduleName: string, url: string, grpcToken?: string) {
    super(moduleName, 'storage', url, grpcToken);
    this.initializeClient(StorageDefinition);
  }

  getFile(id: string): Promise<FileResponse> {
    return this.client!.getFile({ id });
  }

  getFileData(id: string): Promise<GetFileDataResponse> {
    return this.client!.getFileData({ id });
  }

  createFile(
    name: string,
    data: string,
    folder?: string,
    container?: string,
    mimeType?: string,
    isPublic: boolean = false,
  ): Promise<FileResponse> {
    return this.client!.createFile({ name, mimeType, data, folder, isPublic, container });
  }

  updateFile(
    id: string,
    data: string,
    name?: string,
    folder?: string,
    container?: string,
    mimeType?: string,
  ): Promise<FileResponse> {
    return this.client!.updateFile({ name, mimeType, data, folder, id, container });
  }

  deleteFile(id: string): Promise<DeleteFileResponse> {
    return this.client!.deleteFile({ id });
  }

  createFileByUrl(
    name: string,
    folder?: string,
    container?: string,
    mimeType?: string,
    size?: number,
    isPublic: boolean = false,
  ) {
    return this.client!.createFileByUrl({
      name,
      mimeType,
      folder,
      container,
      size,
      isPublic,
    });
  }

  updateFileByUrl(
    id: string,
    name?: string,
    folder?: string,
    container?: string,
    mimeType?: string,
    size?: number,
  ) {
    return this.client!.updateFileByUrl({ id, name, folder, container, mimeType, size });
  }
}
