import { IStorageProvider, StorageConfig } from '../../interfaces/index.js';
import OSS from 'ali-oss';
import fs from 'fs';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { SIGNED_URL_EXPIRY_SECONDS } from '../../constants/expiry.js';

export class AliyunStorage implements IStorageProvider {
  private _activeContainer: string = '';
  private _ossClient: OSS;

  constructor(options: StorageConfig) {
    const conf = options.aliyun;
    if (!conf || !conf.accessKeyId || !conf.accessKeySecret || !conf.region) {
      throw Error('aliyun config is invalid');
    }

    this._ossClient = new OSS({
      region: conf.region,
      accessKeyId: conf.accessKeyId,
      accessKeySecret: conf.accessKeySecret,
    });
  }

  getUploadUrl(fileName: string): Promise<string | Error> {
    const url = this._ossClient.signatureUrl(fileName, {
      expires: SIGNED_URL_EXPIRY_SECONDS,
      method: 'PUT',
    });

    return Promise.resolve(url);
  }

  async containerExists(name: string): Promise<boolean | Error> {
    return await this._ossClient
      .getBucketInfo(name)
      .then(() => true)
      .catch(err => {
        if (err.status === 404) {
          return false;
        }

        throw err;
      });
  }

  async createContainer(name: string): Promise<boolean | Error> {
    await this._ossClient.putBucket(name);
    this.container(name);
    ConduitGrpcSdk.Metrics?.increment('containers_total');
    return true;
  }

  container(name: string): IStorageProvider {
    this._activeContainer = name;
    this._ossClient.useBucket(name);
    return this;
  }

  async deleteContainer(name: string): Promise<boolean | Error> {
    await this._ossClient.deleteBucket(name);
    ConduitGrpcSdk.Metrics?.decrement('containers_total');
    return true;
  }

  async createFolder(name: string): Promise<boolean | Error> {
    await this._ossClient.put(name, Buffer.from(''));
    ConduitGrpcSdk.Metrics?.increment('folders_total');
    return true;
  }

  async folderExists(name: string): Promise<boolean | Error> {
    return await this.exists(name);
  }

  async deleteFolder(name: string): Promise<boolean | Error> {
    let mark = null;

    do {
      const res = await this._ossClient.list(
        {
          prefix: name,
          ['max-keys']: 1000,
        },
        {},
      );
      mark = res.nextMarker;

      await this._ossClient.deleteMulti(
        res.objects.map(it => it.name),
        {
          quiet: true,
        },
      );
    } while (mark);
    ConduitGrpcSdk.Metrics?.decrement('folders_total');
    return true;
  }

  async store(
    fileName: string,
    data: any,
    isPublic: boolean = false,
  ): Promise<boolean | Error> {
    await this._ossClient.put(fileName, data, {
      headers: {
        'x-oss-object-acl': isPublic ? 'public-read' : 'private',
      },
    });
    return true;
  }

  async delete(fileName: string): Promise<boolean | Error> {
    await this._ossClient.delete(fileName);
    ConduitGrpcSdk.Metrics?.decrement('files_total');
    return true;
  }

  async exists(fileName: string): Promise<boolean | Error> {
    return await this._ossClient
      .head(fileName)
      .then(() => true)
      .catch(err => {
        if (err.status === 404) return false;
        throw err;
      });
  }

  async get(fileName: string, downloadPath?: string): Promise<any | Error> {
    const { content } = await this._ossClient.get(fileName);

    if (downloadPath) {
      fs.writeFileSync(downloadPath, content);
    }

    return content;
  }

  async getSignedUrl(fileName: string): Promise<any | Error> {
    const url = this._ossClient.signatureUrl(fileName, {
      expires: SIGNED_URL_EXPIRY_SECONDS,
      method: 'GET',
    });

    return url;
  }

  async getPublicUrl(fileName: string): Promise<any | Error> {
    const url = this._ossClient.signatureUrl(fileName, {
      expires: 3600 * 24 * 365 * 100,
      method: 'GET',
    });

    return url;
  }
}
