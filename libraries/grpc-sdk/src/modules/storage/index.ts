import { ConduitModule } from '../../classes/ConduitModule';
import {
  FileResponse,
  GetFileDataResponse,
  SetConfigResponse,
  StorageDefinition,
  DeepPartial,
  StreamFileRequest, StreamFileResponse
} from '../../protoUtils/storage';

export class Storage extends ConduitModule<typeof StorageDefinition> {
  constructor(private readonly moduleName: string, url: string, grpcToken?: string) {
    super(moduleName, 'storage', url, grpcToken);
    this.initializeClient(StorageDefinition);
  }

  setConfig(newConfig: any): Promise<SetConfigResponse> {
    return this.client!.setConfig(
      {newConfig: JSON.stringify(newConfig)})
      .then(res => {
        return JSON.parse(res.updatedConfig);
      });
  }

  getFile(id: string): Promise<FileResponse> {
    return this.client!.getFile({id});
  }

  getFileData(id: string): Promise<GetFileDataResponse> {
    return this.client!.getFileData({id});
  }

  createFile(
    name: string,
    mimeType: string,
    data: string,
    folder: string,
    isPublic: boolean = false,
  ): Promise<FileResponse> {
    return this.client!.createFile({name, mimeType, data, folder, isPublic});
  }

  async streamFile(file: Express.Multer.File) {
    await this.client!.streamFile(this.streamFileRequest(file));
  }

  private async* streamFileRequest(file: Express.Multer.File): AsyncIterable<DeepPartial<StreamFileRequest>> {
    yield {
      info: {
        name: file.originalname,
        mimeType: file.mimetype,
      },
      chunk: undefined,
    };
    // TODO: Split up file or stream with busboy instead
    const chunks: Buffer[] = [];
    for (const chunk of chunks) {
      yield {
        info: undefined,
        chunk,
      };
    }
  }
}
