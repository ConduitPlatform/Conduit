import { IStorageProvider, StorageConfig, UrlOptions } from '../../interfaces/index.js';
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  DeletePublicAccessBlockCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  PutPublicAccessBlockCommand,
  S3Client,
  S3ClientConfig,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { constructDispositionHeader, streamToBuffer } from '../../utils/index.js';
import fs from 'fs';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { SIGNED_URL_EXPIRY_SECONDS } from '../../constants/expiry.js';
import { Config } from '../../config/index.js';

type AwsError = { $metadata: { httpStatusCode: number } };
type GetResult = Buffer | Error;
type StoreResult = boolean | Error;

export class AWSS3Storage implements IStorageProvider {
  private readonly _storage: S3Client;
  private _activeContainer: string = '';

  constructor(options: StorageConfig) {
    const config: S3ClientConfig = {
      region: options.aws.region,
      credentials: {
        accessKeyId: options.aws.accessKeyId,
        secretAccessKey: options.aws.secretAccessKey,
      },
    };
    if (options.aws.endpoint !== '') {
      config.endpoint = options.aws.endpoint;
      config.forcePathStyle = options.aws.usePathStyle ?? true;
    }

    this._storage = new S3Client(config);
  }

  container(name: string): IStorageProvider {
    this._activeContainer = this.getFormattedContainerName(name);
    return this;
  }

  async store(fileName: string, data: any, isPublic?: boolean): Promise<StoreResult> {
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

  async get(fileName: string, downloadPath?: string): Promise<GetResult> {
    const stream = await this._storage.send(
      new GetObjectCommand({
        Bucket: this._activeContainer,
        Key: fileName,
      }),
    );

    const data = await streamToBuffer(stream.Body as Readable);
    if (downloadPath) {
      fs.writeFileSync(downloadPath, new Uint8Array(data));
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
    ConduitGrpcSdk.Metrics?.increment('folders_total');
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
        (error as AwsError).$metadata.httpStatusCode === 403 ||
        (error as AwsError).$metadata.httpStatusCode === 404
      ) {
        return false;
      }
      throw error;
    }
  }

  async createContainer(name: string, isPublic?: boolean): Promise<boolean | Error> {
    name = this.getFormattedContainerName(name);
    await this._storage.send(
      new CreateBucketCommand({
        Bucket: name,
      }),
    );
    this._activeContainer = name;
    if (isPublic) {
      await this.setContainerPublicAccess(name, true);
    }
    ConduitGrpcSdk.Metrics?.increment('containers_total');
    return true;
  }

  async setContainerPublicAccess(
    name: string,
    isPublic: boolean,
  ): Promise<boolean | Error> {
    const bucketName = this.getFormattedContainerName(name);
    if (isPublic) {
      // Disable public access block to allow public bucket policy
      await this._storage.send(
        new DeletePublicAccessBlockCommand({
          Bucket: bucketName,
        }),
      );
      // Set bucket policy for public read access
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'PublicReadGetObject',
            Effect: 'Allow',
            Principal: '*',
            Action: 's3:GetObject',
            Resource: `arn:aws:s3:::${bucketName}/*`,
          },
        ],
      };
      await this._storage.send(
        new PutBucketPolicyCommand({
          Bucket: bucketName,
          Policy: JSON.stringify(policy),
        }),
      );
    } else {
      // Re-enable public access block
      await this._storage.send(
        new PutPublicAccessBlockCommand({
          Bucket: bucketName,
          PublicAccessBlockConfiguration: {
            BlockPublicAcls: true,
            IgnorePublicAcls: true,
            BlockPublicPolicy: true,
            RestrictPublicBuckets: true,
          },
        }),
      );
    }
    return true;
  }

  async containerExists(name: string): Promise<boolean> {
    name = this.getFormattedContainerName(name);
    try {
      await this._storage.send(new HeadBucketCommand({ Bucket: name }));
      return true;
    } catch (error) {
      if (
        (error as AwsError).$metadata.httpStatusCode === 403 ||
        (error as AwsError).$metadata.httpStatusCode === 404
      ) {
        return false;
      }
      throw error;
    }
  }

  async deleteContainer(name: string): Promise<boolean | Error> {
    name = this.getFormattedContainerName(name);
    await this._storage.send(
      new DeleteBucketCommand({
        Bucket: name,
      }),
    );
    ConduitGrpcSdk.Metrics?.decrement('containers_total');
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
    ConduitGrpcSdk.Metrics?.decrement('folders_total');
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
        (error as AwsError).$metadata.httpStatusCode === 403 ||
        (error as AwsError).$metadata.httpStatusCode === 404
      ) {
        return false;
      }
      throw error;
    }
  }

  async getSignedUrl(fileName: string, options?: UrlOptions) {
    const command = new GetObjectCommand({
      Bucket: this._activeContainer,
      Key: fileName,
      ResponseContentDisposition: constructDispositionHeader(fileName, options),
    });
    return awsGetSignedUrl(this._storage, command, {
      expiresIn: SIGNED_URL_EXPIRY_SECONDS,
    });
  }

  async getPublicUrl(fileName: string, _containerIsPublic?: boolean) {
    // AWS uses bucket-level ACLs, so public URL format is the same regardless
    const config: Config['aws'] = ConfigController.getInstance().config.aws;
    if (config.endpoint !== '') {
      // check if endpoint contains http/https or not
      const requiresPrefix = !config.endpoint.startsWith('http');
      if (config.usePathStyle) {
        return `${requiresPrefix ? 'https://' : ''}${config.endpoint}/${
          this._activeContainer
        }/${fileName}`;
      } else if (requiresPrefix) {
        return `https://${this._activeContainer}.${config.endpoint}/${fileName}`;
      } else if (config.endpoint.startsWith('http://')) {
        const endpoint = config.endpoint.replace('http://', '');
        return `http://${this._activeContainer}.${endpoint}/${fileName}`;
      } else {
        const endpoint = config.endpoint.replace('https://', '');
        return `https://${this._activeContainer}.${endpoint}/${fileName}`;
      }
    }
    if (config.region) {
      return `https://${this._activeContainer}.s3.${config.region}.amazonaws.com/${fileName}`;
    }

    return `https://${this._activeContainer}.s3.amazonaws.com/${fileName}`;
  }

  getUploadUrl(fileName: string): Promise<string | Error> {
    const command = new PutObjectCommand({
      Bucket: this._activeContainer,
      Key: fileName,
    });
    return awsGetSignedUrl(this._storage, command, {
      expiresIn: SIGNED_URL_EXPIRY_SECONDS,
    });
  }

  private getFormattedContainerName(bucketName: string): string {
    const accountId = ConfigController.getInstance().config.aws.accountId;
    return `conduit-${accountId}-${bucketName}`;
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
