import { IStorageProvider, StorageConfig, UrlOptions } from '../../interfaces/index.js';
import { Bucket, Storage } from '@google-cloud/storage';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { SIGNED_URL_EXPIRY_DATE } from '../../constants/expiry.js';
import { constructDispositionHeader } from '../../utils/index.js';
import fs from 'fs';

type GoogleServiceAccountKey = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

const OBJECT_VIEWER_ROLE = 'roles/storage.objectViewer';
const FOLDER_MARKER_SUFFIX = '.keep.txt';

export class GoogleCloudStorage implements IStorageProvider {
  private readonly _storage: Storage;
  private _activeBucket: string = '';

  constructor(options: StorageConfig) {
    this._storage = createGoogleStorageClient(options);
  }

  container(name: string): IStorageProvider {
    this._activeBucket = name;
    return this;
  }

  async store(fileName: string, data: Buffer | string): Promise<boolean | Error> {
    await this.bucket().file(fileName).save(data);
    return true;
  }

  async get(fileName: string, downloadPath?: string): Promise<Buffer | Error> {
    const [contents] = await this.bucket().file(fileName).download();
    if (downloadPath) {
      fs.writeFileSync(downloadPath, new Uint8Array(contents));
    }
    return contents;
  }

  async createFolder(name: string): Promise<boolean | Error> {
    const exists = await this.folderExists(name);
    if (exists) return true;

    await this.bucket()
      .file(this.folderMarkerKey(name))
      .save(Buffer.from('DO NOT DELETE'));
    ConduitGrpcSdk.Metrics?.increment('folders_total');
    return true;
  }

  async folderExists(name: string): Promise<boolean | Error> {
    const [bucketExists] = await this.bucket().exists();
    if (!bucketExists) return false;

    const [markerExists] = await this.bucket().file(this.folderMarkerKey(name)).exists();
    return markerExists;
  }

  async createContainer(name: string, isPublic?: boolean): Promise<boolean | Error> {
    await this._storage.createBucket(name, {
      iamConfiguration: {
        uniformBucketLevelAccess: {
          enabled: true,
        },
      },
    });
    this._activeBucket = name;
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
    const bucket = this._storage.bucket(name);
    await ensureUniformBucketLevelAccess(bucket);

    const [policy] = await bucket.iam.getPolicy({ requestedPolicyVersion: 3 });

    if (isPublic) {
      const viewerBinding = policy.bindings.find(
        binding => binding.role === OBJECT_VIEWER_ROLE,
      );
      if (viewerBinding) {
        if (!viewerBinding.members.includes('allUsers')) {
          viewerBinding.members.push('allUsers');
        }
      } else {
        policy.bindings.push({
          role: OBJECT_VIEWER_ROLE,
          members: ['allUsers'],
        });
      }
    } else {
      policy.bindings = policy.bindings
        .map(binding => {
          if (binding.role !== OBJECT_VIEWER_ROLE) return binding;
          return {
            ...binding,
            members: binding.members.filter(member => member !== 'allUsers'),
          };
        })
        .filter(binding => binding.members.length > 0);
    }

    await bucket.iam.setPolicy(policy);
    return true;
  }

  async containerExists(name: string): Promise<boolean | Error> {
    const [exists] = await this._storage.bucket(name).exists();
    return exists;
  }

  async deleteContainer(name: string): Promise<boolean | Error> {
    const bucket = this._storage.bucket(name);
    await bucket.deleteFiles({ force: true });
    await bucket.delete();
    ConduitGrpcSdk.Metrics?.decrement('containers_total');
    return true;
  }

  async deleteFolder(name: string): Promise<boolean | Error> {
    const exists = await this.folderExists(name);
    if (!exists) return false;

    ConduitGrpcSdk.Logger.log('Getting files list...');
    const files = await this.listFiles(name);

    ConduitGrpcSdk.Logger.log('Deleting files...');
    let deleted = 0;
    for (const file of files) {
      deleted++;
      await file.delete({ ignoreNotFound: true });
      ConduitGrpcSdk.Logger.log(file.name);
    }
    ConduitGrpcSdk.Logger.log(`${deleted} files deleted.`);
    ConduitGrpcSdk.Metrics?.decrement('folders_total');
    return true;
  }

  async delete(fileName: string): Promise<boolean | Error> {
    await this.bucket().file(fileName).delete({ ignoreNotFound: true });
    return true;
  }

  async exists(fileName: string): Promise<boolean | Error> {
    const [bucketExists] = await this.bucket().exists();
    if (!bucketExists) return false;

    const [fileExists] = await this.bucket().file(fileName).exists();
    return fileExists;
  }

  async getSignedUrl(fileName: string, options?: UrlOptions): Promise<string | Error> {
    const [url] = await this.bucket()
      .file(fileName)
      .getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: SIGNED_URL_EXPIRY_DATE(),
        responseDisposition: constructDispositionHeader(fileName, options),
      });
    return url;
  }

  async getPublicUrl(
    fileName: string,
    containerIsPublic?: boolean,
  ): Promise<string | Error> {
    if (!containerIsPublic) {
      return new Error('Public URL is only available for files in public containers');
    }
    return this.bucket().file(fileName).publicUrl();
  }

  getUploadUrl(fileName: string): Promise<string | Error> {
    return this.bucket()
      .file(fileName)
      .getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: SIGNED_URL_EXPIRY_DATE(),
      })
      .then(([url]) => url);
  }

  private bucket(): Bucket {
    return this._storage.bucket(this._activeBucket);
  }

  private folderMarkerKey(name: string): string {
    return `${name}${FOLDER_MARKER_SUFFIX}`;
  }

  private async listFiles(folderName: string) {
    const [files] = await this.bucket().getFiles({ prefix: folderName });
    return files;
  }
}

function createGoogleStorageClient(options: StorageConfig): Storage {
  const { serviceAccountKeyPath, serviceAccountKeyJson } = options.google;

  if (serviceAccountKeyJson) {
    const credentials = parseServiceAccountKeyJson(serviceAccountKeyJson);
    return new Storage({
      projectId: credentials.project_id,
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
    });
  }

  if (serviceAccountKeyPath) {
    return new Storage({ keyFilename: serviceAccountKeyPath });
  }

  return new Storage();
}

function parseServiceAccountKeyJson(raw: string): GoogleServiceAccountKey {
  try {
    const credentials = JSON.parse(raw) as GoogleServiceAccountKey;
    if (!credentials.client_email || !credentials.private_key) {
      throw new Error('Missing client_email or private_key');
    }
    return credentials;
  } catch (error) {
    throw new Error(`Invalid google.serviceAccountKeyJson: ${(error as Error).message}`);
  }
}

async function ensureUniformBucketLevelAccess(bucket: Bucket): Promise<void> {
  const [metadata] = await bucket.getMetadata();
  if (metadata.iamConfiguration?.uniformBucketLevelAccess?.enabled) {
    return;
  }

  await bucket.setMetadata({
    iamConfiguration: {
      uniformBucketLevelAccess: {
        enabled: true,
      },
    },
  });
}
