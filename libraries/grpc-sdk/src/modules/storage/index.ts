import { ConduitModule } from '../../classes/ConduitModule';
import { StorageClient } from '../../protoUtils/storage';

export default class Storage extends ConduitModule<StorageClient> {
  constructor(url: string) {
    super(url);
    this.initializeClient(StorageClient);
  }

  setConfig(newConfig: any) {
    return new Promise((resolve, reject) => {
      this.client?.setConfig(
        { newConfig: JSON.stringify(newConfig) },
        (err: any, res: any) => {
          if (err || !res) {
            reject(err || 'Something went wrong');
          } else {
            resolve(JSON.parse(res.updatedConfig));
          }
        }
      );
    });
  }

  getFile(id: string) {
    return new Promise((resolve, reject) => {
      this.client?.getFile({ id }, (err: any, res: any) => {
        if (err || !res) {
          reject(err || 'Something went wrong');
        } else {
          resolve(JSON.parse(res.fileDocument));
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
  ) {
    return new Promise((resolve, reject) => {
      this.client?.createFile(
        { name, mimeType, data, folder, isPublic },
        (err: any, res: any) => {
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
