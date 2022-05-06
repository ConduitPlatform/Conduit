import { ConduitModule } from '../../classes/ConduitModule';
import { FileResponse, GetFileDataResponse, SetConfigResponse, StorageDefinition } from '../../protoUtils/storage';

export class Storage extends ConduitModule<typeof StorageDefinition> {
  constructor(private readonly moduleName: string, url: string, grpcToken?: string) {
    super(moduleName, 'storage', url, grpcToken);
    this.initializeClient(StorageDefinition);
  }

  setConfig(newConfig: any): Promise<SetConfigResponse> {
    return this.client!.setConfig(
      { newConfig: JSON.stringify(newConfig) })
      .then(res => {
        return JSON.parse(res.updatedConfig);
      });
  }

  getFile(id: string): Promise<FileResponse> {
    return this.client!.getFile({ id });
  }

  getFileData(id: string): Promise<GetFileDataResponse> {
    return this.client!.getFileData({ id });
  }

  createFile(
    name: string,
    mimeType: string,
    data: string,
    folder: string,
    isPublic: boolean = false,
  ): Promise<FileResponse> {
    return this.client!.createFile({ name, mimeType, data, folder, isPublic });
  }
}
