import { IStorageProvider, StorageConfig } from '../../interfaces';
import {
  CopyObjectCommand,
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { streamToBuffer } from '../../utils/utils';
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
    //check if keep.txt file exists
    const exists = await this.folderExists(name);
    if (exists) return true;

    await this._storage.send(
      new PutObjectCommand({
        Bucket: this._activeContainer,
        Key: name + '.keep.txt',
        Body: 'DO NOT DELETE',
      })
    );
    return true;
  }

  async folderExists(name: string): Promise<boolean | Error> {
    try {
      await this._storage.send(
        new HeadObjectCommand({
          Bucket: this._activeContainer,
          Key: name + '.keep.txt',
        })
      );
      return true;
    } catch (error: any) {
      if (
        error.$metadata.httpStatusCode === 403 ||
        error.$metadata.httpStatusCode === 404
      ) {
        return false;
      }
      throw Error(error);
    }
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
      console.log('error', error, error.statusCode);
      if (
        error.$metadata.httpStatusCode === 403 ||
        error.$metadata.httpStatusCode === 404
      ) {
        return false;
      }
      throw Error(error);
    }
  }
  async deleteContainer(name: string): Promise<boolean | Error> {
    await this._storage.send(
      new DeleteBucketCommand({
        Bucket: name,
      })
    );
    return true;
  }

  async deleteFolder(name: string): Promise<boolean | Error> {
    let exists = await this.folderExists(name);
    if (!exists) return false;

    console.log('Getting files list...');
    let files = await this.listFiles(name);

    let i = 0;
    console.log('Deleting files...');
    for (const file of files) {
      i++;
      await this.delete(file.Key!);
      console.log(file.Key!);
    }
    console.log(`${i} files deleted.`);
    return true;
  }
  async delete(fileName: string): Promise<boolean | Error> {
    await this._storage.send(
      new DeleteObjectCommand({
        Bucket: this._activeContainer,
        Key: fileName,
      })
    );
    return true;
  }
  async exists(fileName: string): Promise<boolean | Error> {
    try {
      await this._storage.send(
        new HeadObjectCommand({
          Bucket: this._activeContainer,
          Key: fileName,
        })
      );
      return true;
    } catch (error: any) {
      if (
        error.$metadata.httpStatusCode === 403 ||
        error.$metadata.httpStatusCode === 404
      ) {
        return false;
      }
      throw Error(error);
    }
  }
  async getSignedUrl(fileName: string): Promise<any> {
    throw new Error('Method not implemented.');
  }
  async getPublicUrl(fileName: string): Promise<any> {
    throw new Error('Method not implemented.');
  }
  async rename(currentFilename: string, newFilename: string): Promise<boolean | Error> {
    await this._storage.send(
      new CopyObjectCommand({
        Bucket: this._activeContainer,
        CopySource: `${this._activeContainer}/${currentFilename}`,
        Key: newFilename,
      })
    );
    return true;
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

  private async listFiles(name: string) {
    const files = await this._storage.send(
      new ListObjectsCommand({
        Bucket: this._activeContainer,
        Prefix: name,
      })
    );
    if (!files.Contents) return [];
    return files.Contents;
  }
}
