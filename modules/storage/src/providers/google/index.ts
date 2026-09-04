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
export const FOLDER_MARKER_SUFFIX = '.keep.txt';

export function folderMarkerKeys(name: string): string[] {
  const trimmed = name.replace(/\/+$/, '');
  return Array.from(new Set([`${name}${FOLDER_MARKER_SUFFIX}`, `${trimmed}/keep.txt`]));
}

export function folderObjectPrefix(name: string): string {
  return name.endsWith('/') ? name : `${name}/`;
}

export function isDirectChildKey(prefix: string, key: string): boolean {
  if (!key.startsWith(prefix)) {
    return false;
  }
  const rest = key.slice(prefix.length);
  return rest.length > 0 && !rest.includes('/');
}

export const FOLDER_DELETE_PAGE_SIZE = 200;

export function folderListQuery(name: string, pageToken?: string) {
  return {
    prefix: folderObjectPrefix(name),
    delimiter: '/',
    autoPaginate: false as const,
    maxResults: FOLDER_DELETE_PAGE_SIZE,
    ...(pageToken ? { pageToken } : {}),
  };
}

type IamBinding = { role: string; members: string[] };
type IamPolicy = { bindings?: IamBinding[]; [key: string]: unknown };

export function applyAllUsersObjectViewer(
  policy: IamPolicy,
  isPublic: boolean,
): IamPolicy {
  const bindings = (policy.bindings ?? []).map(binding => ({
    ...binding,
    members: [...binding.members],
  }));

  if (isPublic) {
    const viewerBinding = bindings.find(binding => binding.role === OBJECT_VIEWER_ROLE);
    if (viewerBinding) {
      if (!viewerBinding.members.includes('allUsers')) {
        viewerBinding.members.push('allUsers');
      }
    } else {
      bindings.push({
        role: OBJECT_VIEWER_ROLE,
        members: ['allUsers'],
      });
    }
    return { ...policy, bindings };
  }

  return {
    ...policy,
    bindings: bindings
      .map(binding => {
        if (binding.role !== OBJECT_VIEWER_ROLE) return binding;
        return {
          ...binding,
          members: binding.members.filter(member => member !== 'allUsers'),
        };
      })
      .filter(binding => binding.members.length > 0),
  };
}

type FolderFile = {
  name: string;
  delete: (options?: { ignoreNotFound?: boolean }) => Promise<unknown>;
};

type FolderBucket = {
  getFiles: (
    query: ReturnType<typeof folderListQuery>,
  ) => Promise<
    readonly [
      ReadonlyArray<FolderFile>,
      { pageToken?: string } | null | undefined,
      { nextPageToken?: string }?,
    ]
  >;
  file: (name: string) => FolderFile;
};

export async function deleteOneLevelFolder(
  bucket: FolderBucket,
  name: string,
): Promise<number> {
  const prefix = folderObjectPrefix(name);
  const markers = new Set(folderMarkerKeys(name));
  let deleted = 0;
  let pageToken: string | undefined;

  for (;;) {
    const [files, nextQuery, apiResponse] = await bucket.getFiles(
      folderListQuery(name, pageToken),
    );
    for (const file of files) {
      if (markers.has(file.name) || !isDirectChildKey(prefix, file.name)) {
        continue;
      }
      await file.delete({ ignoreNotFound: true });
      deleted++;
    }
    pageToken = nextQuery?.pageToken ?? apiResponse?.nextPageToken;
    if (!pageToken) {
      break;
    }
  }

  for (const key of markers) {
    await bucket.file(key).delete({ ignoreNotFound: true });
  }

  return deleted;
}

type PublicAccessBucket = {
  iam: {
    getPolicy: (options: { requestedPolicyVersion: number }) => Promise<IamPolicy[]>;
    setPolicy: (policy: IamPolicy) => Promise<unknown>;
  };
  getMetadata: () => Promise<
    Array<{ iamConfiguration?: { uniformBucketLevelAccess?: { enabled?: boolean } } }>
  >;
  setMetadata: (metadata: {
    iamConfiguration: { uniformBucketLevelAccess: { enabled: boolean } };
  }) => Promise<unknown>;
};

export async function setBucketPublicAccess(
  bucket: PublicAccessBucket,
  isPublic: boolean,
): Promise<void> {
  const [policy] = await bucket.iam.getPolicy({ requestedPolicyVersion: 3 });
  await bucket.iam.setPolicy(applyAllUsersObjectViewer(policy, isPublic));
  if (isPublic) {
    await ensureUniformBucketLevelAccess(bucket);
  }
}

type ContainerStorage = {
  createBucket: (
    name: string,
    options: { iamConfiguration: { uniformBucketLevelAccess: { enabled: boolean } } },
  ) => Promise<unknown>;
  bucket: (name: string) => PublicAccessBucket & {
    deleteFiles: (options: { force: boolean }) => Promise<unknown>;
    delete: () => Promise<unknown>;
  };
};

export async function createGcsContainer(
  storage: ContainerStorage,
  name: string,
  isPublic?: boolean,
): Promise<void> {
  await storage.createBucket(name, {
    iamConfiguration: {
      uniformBucketLevelAccess: {
        enabled: true,
      },
    },
  });
  try {
    if (isPublic) {
      await setBucketPublicAccess(storage.bucket(name), true);
    }
  } catch (error) {
    try {
      const bucket = storage.bucket(name);
      await bucket.deleteFiles({ force: true });
      await bucket.delete();
    } catch (cleanupError) {
      ConduitGrpcSdk.Logger?.error(
        `Failed to clean up GCS bucket "${name}" after public-access setup failed: ${
          (cleanupError as Error).message
        }`,
      );
    }
    throw error;
  }
}

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

    for (const key of folderMarkerKeys(name)) {
      const [markerExists] = await this.bucket().file(key).exists();
      if (markerExists) return true;
    }
    return false;
  }

  async createContainer(name: string, isPublic?: boolean): Promise<boolean | Error> {
    await createGcsContainer(
      this._storage as unknown as ContainerStorage,
      name,
      isPublic,
    );
    this._activeBucket = name;
    ConduitGrpcSdk.Metrics?.increment('containers_total');
    return true;
  }

  async setContainerPublicAccess(
    name: string,
    isPublic: boolean,
  ): Promise<boolean | Error> {
    await setBucketPublicAccess(
      this._storage.bucket(name) as unknown as PublicAccessBucket,
      isPublic,
    );
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

    const deleted = await deleteOneLevelFolder(
      this.bucket() as unknown as FolderBucket,
      name,
    );
    ConduitGrpcSdk.Logger?.log(`Deleted ${deleted} object(s) from folder ${name}`);
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

async function ensureUniformBucketLevelAccess(bucket: PublicAccessBucket): Promise<void> {
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
