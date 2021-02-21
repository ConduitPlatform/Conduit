import path from 'path';
import { ConduitModule } from '../../classes/ConduitModule';

export default class Storage extends ConduitModule {
  constructor(url: string) {
    super(url);
    this.protoPath = path.resolve(__dirname, '../../proto/storage.proto');
    this.descriptorObj = 'storage.Storage';
    this.initializeClient();
  }

  setConfig(newConfig: any) {
    return new Promise((resolve, reject) => {
      this.client.setConfig(
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
      this.client.getFile({ id }, (err: any, res: any) => {
        if (err || !res) {
          reject(err || 'Something went wrong');
        } else {
          resolve(JSON.parse(res.fileDocument));
        }
      });
    });
  }

  createFile(name: string, mimeType: string, data: string, folder: string) {
    return new Promise((resolve, reject) => {
      this.client.createFile({ name, mimeType, data, folder }, (err: any, res: any) => {
        if (err || !res) {
          reject(err || 'Something went wrong');
        } else {
          resolve(JSON.parse(res.fileDocument));
        }
      });
    });
  }
}
