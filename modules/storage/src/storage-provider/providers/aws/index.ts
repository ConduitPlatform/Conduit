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
  PutObjectAclCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { streamToBuffer } from '../../utils/utils';
import fs from 'fs';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';
import ConduitGrpcSdk, { ConfigController } from '@conduitplatform/grpc-sdk';

export class AWSS3Storage implements IStorageProvider {
  private _storage: S3Client;
  private _activeContainer: string = '';

  constructor(options: StorageConfig) {
    const config = {
      region: options.aws.region,
      credentials: {
        accessKeyId: options.aws.accessKeyId,
        secretAccessKey: options.aws.secretAccessKey,
      },
    };
    this._storage = new S3Client(config);
  }

  private getFormattedContainerName(bucketName: string): string {
    const accountId = ConfigController.getInstance().config.aws.accountId;
    return `conduit-${accountId}-${bucketName}`;
  }

  container(name: string): IStorageProvider {
    this._activeContainer = this.getFormattedContainerName(name);
    return this;
  }

  async store(fileName: string, data: any, isPublic?: boolean): Promise<boolean | Error> {
    await this._storage.send(
      new PutObjectCommand({
        Bucket: this._activeContainer,
        Key: fileName,
        Body: data,
        GrantRead: isPublic
          ? 'uri="http://acs.amazonaws.com/groups/global/AllUsers"'
          : undefined,
      }),
    );
    return true;
  }
  async get(fileName: string, downloadPath?: string): Promise<any | Error> {
    const stream = await this._storage.send(
      new GetObjectCommand({
        Bucket: this._activeContainer,
        Key: fileName,
      }),
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
      }),
    );
    return true;
  }

  async folderExists(name: string): Promise<boolean | Error> {
    try {
      await this._storage.send(
        new HeadObjectCommand({
          Bucket: this._activeContainer,
          Key: name + '.keep.txt',
        }),
      );
      return true;
    } catch (error) {
      if (
        (error as any).$metadata.httpStatusCode === 403 ||
        (error as any).$metadata.httpStatusCode === 404
      ) {
        return false;
      }
      throw Error(error as any);
    }
  }

  async createContainer(name: string): Promise<boolean | Error> {
    name = this.getFormattedContainerName(name);
    await this._storage.send(
      new CreateBucketCommand({
        Bucket: name,
      }),
    );
    this._activeContainer = name;
    return true;
  }

  async containerExists(name: string): Promise<boolean> {
    name = this.getFormattedContainerName(name);
    try {
      await this._storage.send(new HeadBucketCommand({ Bucket: name }));
      return true;
    } catch (error) {
      if (
        (error as any).$metadata.httpStatusCode === 403 ||
        (error as any).$metadata.httpStatusCode === 404
      ) {
        return false;
      }
      throw Error(error as any);
    }
  }

  async deleteContainer(name: string): Promise<boolean | Error> {
    name = this.getFormattedContainerName(name);
    await this._storage.send(
      new DeleteBucketCommand({
        Bucket: name,
      }),
    );
    return true;
  }

  async deleteFolder(name: string): Promise<boolean | Error> {
    const exists = await this.folderExists(name);
    if (!exists) return false;

    ConduitGrpcSdk.Logger.log('Getting files list...');
    const files = await this.listFiles(name);

    let i = 0;
    ConduitGrpcSdk.Logger.log('Deleting files...');
    for (const file of files) {
      i++;
      await this.delete(file.Key!);
      ConduitGrpcSdk.Logger.log(file.Key!);
    }
    ConduitGrpcSdk.Logger.log(`${i} files deleted.`);
    return true;
  }

  async delete(fileName: string): Promise<boolean | Error> {
    await this._storage.send(
      new DeleteObjectCommand({
        Bucket: this._activeContainer,
        Key: fileName,
      }),
    );
    return true;
  }

  async exists(fileName: string): Promise<boolean | Error> {
    try {
      await this._storage.send(
        new HeadObjectCommand({
          Bucket: this._activeContainer,
          Key: fileName,
        }),
      );
      return true;
    } catch (error) {
      if (
        (error as any).$metadata.httpStatusCode === 403 ||
        (error as any).$metadata.httpStatusCode === 404
      ) {
        return false;
      }
      throw Error(error as any);
    }
  }

  async getSignedUrl(fileName: string) {
    const command = new GetObjectCommand({
      Bucket: this._activeContainer,
      Key: fileName,
    });
    const url = await awsGetSignedUrl(this._storage, command);
    return url;
  }

  async getPublicUrl(fileName: string) {
    return `https://${this._activeContainer}.s3.amazonaws.com/${fileName}`;
  }

  async rename(currentFilename: string, newFilename: string): Promise<boolean | Error> {
    throw new Error('Not implemented');
  }

  async moveToFolder(filename: string, newFolder: string): Promise<boolean | Error> {
    throw new Error('Method not implemented.');
  }

  async moveToFolderAndRename(
    currentFilename: string,
    newFilename: string,
    newFolder: string,
  ): Promise<boolean | Error> {
    throw new Error('Method not implemented.');
  }

  async moveToContainer(
    filename: string,
    newContainer: string,
  ): Promise<boolean | Error> {
    throw new Error('Method not implemented.');
  }

  async moveToContainerAndRename(
    currentFilename: string,
    newFilename: string,
    newContainer: string,
  ): Promise<boolean | Error> {
    throw new Error('Method not implemented.');
  }

  private async listFiles(name: string) {
    const files = await this._storage.send(
      new ListObjectsCommand({
        Bucket: this._activeContainer,
        Prefix: name,
      }),
    );
    if (!files.Contents) return [];
    return files.Contents;
  }
}
