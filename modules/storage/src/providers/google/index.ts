import { IStorageProvider, StorageConfig, UrlOptions } from '../../interfaces/index.js';
import { Storage } from '@google-cloud/storage';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { SIGNED_URL_EXPIRY_DATE } from '../../constants/expiry.js';
import { constructDispositionHeader } from '../../utils/index.js';

/**
 * WARNING: DO NOT USE THIS, IT NEEDS A REWRITE
 * @Deprecated
 */
export class GoogleCloudStorage implements IStorageProvider {
  _storage: Storage;
  _activeBucket: string = '';

  constructor(options: StorageConfig) {
    this._storage = new Storage({
      keyFilename: options.google.serviceAccountKeyPath,
    });
  }

  deleteContainer(name: string): Promise<boolean | Error> {
    throw new Error('Method not implemented.');
  }

  deleteFolder(name: string): Promise<boolean | Error> {
    throw new Error('Method not implemented.');
  }

  async createContainer(name: string, isPublic?: boolean): Promise<boolean | Error> {
    // Creates the new bucket
    await this._storage.createBucket(name);
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
    if (isPublic) {
      // Make all objects in the bucket publicly readable
      await bucket.makePublic();
    } else {
      // Remove public access
      await bucket.makePrivate({ includeFiles: true });
    }
    return true;
  }

  container(name: string): IStorageProvider {
    this._activeBucket = name;
    return this;
  }

  async containerExists(name: string): Promise<boolean | Error> {
    const exists = await this._storage.bucket(name).exists();
    return exists[0];
  }

  /**
   * Used to create a new folder
   * @param name For the folder
   */
  async createFolder(name: string): Promise<boolean | Error> {
    const bucket = await this._storage.bucket(this._activeBucket);
    let exists = await bucket.exists();
    if (!exists[0]) {
      await bucket.create();
    }

    exists = await bucket.file(name + '/keep.txt').exists();
    if (exists[0]) {
      return true;
    }
    await bucket.file(name + '/keep.txt').save(Buffer.from('DO NOT DELETE'));
    ConduitGrpcSdk.Metrics?.increment('folders_total');
    return true;
  }

  async folderExists(name: string): Promise<boolean | Error> {
    const bucket = await this._storage.bucket(this._activeBucket);
    let exists = await bucket.exists();
    if (!exists[0]) {
      return false;
    }

    exists = await bucket.file(name + '/keep.txt').exists();

    return exists[0];
  }

  async delete(fileName: string): Promise<boolean | Error> {
    await this._storage.bucket(this._activeBucket).file(fileName).delete();
    return true;
  }

  async exists(fileName: string): Promise<boolean | Error> {
    await this._storage.bucket(this._activeBucket).file(fileName).exists();
    return true;
  }

  async get(fileName: string, downloadPath?: string): Promise<any | Error> {
    let promise;
    if (downloadPath) {
      promise = this._storage.bucket(this._activeBucket).file(fileName).download({
        destination: downloadPath,
      });
    } else {
      promise = this._storage.bucket(this._activeBucket).file(fileName).download();
    }

    return promise.then((r: any) => {
      if (r.data && r.data[0]) {
        return r.data[0];
      }
      return r;
    });
  }

  async getSignedUrl(fileName: string, options?: UrlOptions): Promise<any | Error> {
    this._storage
      .bucket(this._activeBucket)
      .file(fileName)
      .getSignedUrl({
        action: 'read',
        expires: SIGNED_URL_EXPIRY_DATE(),
        responseDisposition: constructDispositionHeader(fileName, options),
      })
      .then((r: any) => {
        if (r.data && r.data[0]) {
          return r.data[0];
        }
        return r;
      });
  }

  async getPublicUrl(
    fileName: string,
    _containerIsPublic?: boolean,
  ): Promise<string | Error> {
    // GCS uses bucket/file-level ACLs, publicUrl() works regardless
    return this._storage.bucket(this._activeBucket).file(fileName).publicUrl();
  }

  async store(
    fileName: string,
    data: any,
    isPublic: boolean = false,
  ): Promise<boolean | Error> {
    await this._storage.bucket(this._activeBucket).file(fileName).save(data);
    if (isPublic) {
      await this._storage.bucket(this._activeBucket).file(fileName).makePublic();
    }
    return true;
  }

  getUploadUrl(fileName: string): Promise<string | Error> {
    return this._storage
      .bucket(this._activeBucket)
      .file(fileName)
      .getSignedUrl({
        action: 'write',
        expires: SIGNED_URL_EXPIRY_DATE(),
      })
      .then((r: any) => {
        if (r.data && r.data[0]) {
          return r.data[0];
        }
        return r;
      });
  }
}
