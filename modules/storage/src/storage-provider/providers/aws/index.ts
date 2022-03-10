import { IStorageProvider, StorageConfig } from '../../interfaces';
import {
  BucketAlreadyExists,
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { streamToBuffer } from '../../../utils/utils';
import fs from 'fs';

export class AWSS3Storage implements IStorageProvider {
  private _storage: S3Client;
  private _activeContainer: string = '';

  constructor(options: StorageConfig) {
    this._storage = new S3Client({
      region: options.aws.region,
      credentials: {
        accessKeyId: options.aws.accessKeyId,
        secretAccessKey: options.aws.secretAccessKey,
      },
    });
  }

  container(name: string): IStorageProvider {
    this._activeContainer = name;
    return this;
  }

  async store(fileName: string, data: any, isPublic?: boolean): Promise<boolean | Error> {
    await this._storage.send(
      new PutObjectCommand({
        Bucket: this._activeContainer,
        Key: fileName,
        Body: data,
      })
    );
    return true;
  }
  async get(fileName: string, downloadPath?: string): Promise<any | Error> {
    const stream = await this._storage.send(
      new GetObjectCommand({
        Bucket: this._activeContainer,
        Key: fileName,
      })
    );

    const data = await streamToBuffer(stream.Body as Readable);
    if (downloadPath) {
      fs.writeFileSync(downloadPath, data);
    }
    return data;
  }

  async createFolder(name: string): Promise<boolean | Error> {
    throw new Error('Method not implemented.');
  }

  async folderExists(name: string): Promise<boolean | Error> {
    throw new Error('Method not implemented.');
  }

  async createContainer(name: string): Promise<boolean | Error> {
    await this._storage.send(
      new CreateBucketCommand({
        Bucket: name,
      })
    );
    this._activeContainer = name;
    return true;
  }

  async containerExists(name: string): Promise<boolean> {
    try {
      await this._storage.send(new HeadBucketCommand({ Bucket: name }));
      return true;
    } catch (error: any) {
      return false;
    }
  }
  async deleteContainer(name: string): Promise<boolean | Error> {
    throw new Error('Method not implemented.');
  }
  async deleteFolder(name: string): Promise<boolean | Error> {
    throw new Error('Method not implemented.');
  }
  async delete(fileName: string): Promise<boolean | Error> {
    throw new Error('Method not implemented.');
  }
  async exists(fileName: string): Promise<boolean | Error> {
    throw new Error('Method not implemented.');
  }
  async getSignedUrl(fileName: string): Promise<any> {
    throw new Error('Method not implemented.');
  }
  async getPublicUrl(fileName: string): Promise<any> {
    throw new Error('Method not implemented.');
  }
  async rename(currentFilename: string, newFilename: string): Promise<boolean | Error> {
    throw new Error('Method not implemented.');
  }
  async moveToFolder(filename: string, newFolder: string): Promise<boolean | Error> {
    throw new Error('Method not implemented.');
  }
  async moveToFolderAndRename(
    currentFilename: string,
    newFilename: string,
    newFolder: string
  ): Promise<boolean | Error> {
    throw new Error('Method not implemented.');
  }
  async moveToContainer(
    filename: string,
    newContainer: string
  ): Promise<boolean | Error> {
    throw new Error('Method not implemented.');
  }
  async moveToContainerAndRename(
    currentFilename: string,
    newFilename: string,
    newContainer: string
  ): Promise<boolean | Error> {
    throw new Error('Method not implemented.');
  }
}
