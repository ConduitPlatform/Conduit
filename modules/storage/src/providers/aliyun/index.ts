import { IStorageProvider, StorageConfig } from '../../interfaces';
import OSS from 'ali-oss';
import fs from 'fs';
import { basename } from 'path';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

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
    ConduitGrpcSdk.Metrics?.increment('files_total');
    ConduitGrpcSdk.Metrics?.increment('storage_size_bytes_total', data.byteLength);
    return true;
  }

  async delete(fileName: string): Promise<boolean | Error> {
    await this._ossClient.delete(fileName);
    ConduitGrpcSdk.Metrics?.decrement('files_total');
    // ConduitGrpcSdk.Metrics?.decrement('storage_size_bytes_total', fileSize); TODO: get file size from oss client
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
      expires: 3600,
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

  async rename(currentFilename: string, newFilename: string): Promise<boolean | Error> {
    await this._ossClient.copy(newFilename, currentFilename);
    await this.delete(currentFilename);
    return true;
  }

  async moveToFolder(filename: string, newFolder: string): Promise<boolean | Error> {
    await this._ossClient.copy(newFolder + basename(filename), filename);
    await this.delete(filename);
    return true;
  }

  async moveToFolderAndRename(
    currentFilename: string,
    newFilename: string,
    newFolder: string,
  ): Promise<boolean | Error> {
    await this._ossClient.copy(newFolder + newFilename, currentFilename);
    await this.delete(currentFilename);
    return true;
  }

  async moveToContainer(
    filename: string,
    newContainer: string,
  ): Promise<boolean | Error> {
    const oldBucket = this._activeContainer;

    this._ossClient.useBucket(newContainer);

    await this._ossClient.copy(filename, filename, oldBucket);

    this._ossClient.useBucket(oldBucket);

    await this.delete(filename);

    return true;
  }

  async moveToContainerAndRename(
    currentFilename: string,
    newFilename: string,
    newContainer: string,
  ): Promise<boolean | Error> {
    const oldBucket = this._activeContainer;

    this._ossClient.useBucket(newContainer);

    await this._ossClient.copy(newFilename, currentFilename, oldBucket);

    this._ossClient.useBucket(oldBucket);

    await this.delete(currentFilename);

    return true;
  }
}
