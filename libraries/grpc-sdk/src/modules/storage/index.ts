import { ConduitModule } from '../../classes/ConduitModule';
import { FileResponse, GetFileDataResponse, SetConfigResponse, StorageClient } from '../../protoUtils/storage';
import { ServiceError } from '@grpc/grpc-js';

export class Storage extends ConduitModule<StorageClient> {
  constructor(url: string) {
    super(url);
    this.initializeClient(StorageClient);
  }

  setConfig(newConfig: any): Promise<SetConfigResponse> {
    return new Promise((resolve, reject) => {
      this.client?.setConfig(
        { newConfig: JSON.stringify(newConfig) },
        (err: ServiceError | null, res) => {
          if (err || !res) {
            reject(err || 'Something went wrong');
          } else {
            resolve(JSON.parse(res.updatedConfig));
          }
        }
      );
    });
  }

  getFile(id: string): Promise<FileResponse> {
    return new Promise((resolve, reject) => {
      this.client?.getFile({ id }, (err: ServiceError | null, res) => {
        if (err || !res) {
          reject(err || 'Something went wrong');
        } else {
          resolve(res);
        }
      });
    });
  }

  getFileData(id: string): Promise<GetFileDataResponse> {
    return new Promise((resolve, reject) => {
      this.client?.getFileData({ id }, (err: ServiceError | null, res) => {
        if (err || !res) {
          reject(err || 'Something went wrong');
        } else {
          resolve(res);
        }
      });
    });
  }

  createFile(
    name: string,
    mimeType: string,
    data: string,
    folder: string,
    isPublic: boolean = false
  ): Promise<FileResponse> {
    return new Promise((resolve, reject) => {
      this.client?.createFile(
        { name, mimeType, data, folder, isPublic },
        (err: ServiceError | null, res) => {
          if (err || !res) {
            reject(err || 'Something went wrong');
          } else {
            resolve({ id: res.id, name: res.name, url: res.url });
          }
        }
      );
    });
  }
}
