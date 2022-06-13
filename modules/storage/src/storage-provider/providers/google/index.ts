import { IStorageProvider, StorageConfig } from '../../interfaces';

import { Storage } from '@google-cloud/storage';

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

  async createContainer(name: string): Promise<boolean | Error> {
    // Creates the new bucket
    await this._storage.createBucket(name);
    this._activeBucket = name;
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

  async moveToContainer(
    filename: string,
    newContainer: string,
  ): Promise<boolean | Error> {
    const newBucketFile = this._storage.bucket(newContainer).file(filename);
    await this._storage.bucket(this._activeBucket).file(filename).move(newBucketFile);
    return true;
  }

  async moveToContainerAndRename(
    currentFilename: string,
    newFilename: string,
    newContainer: string,
  ): Promise<boolean | Error> {
    const newBucketFile = this._storage.bucket(newContainer).file(newFilename);
    await this._storage
      .bucket(this._activeBucket)
      .file(currentFilename)
      .move(newBucketFile);
    return true;
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

  async getSignedUrl(fileName: string): Promise<any | Error> {
    this._storage
      .bucket(this._activeBucket)
      .file(fileName)
      .getSignedUrl({
        action: 'read',
        expires: Date.now() + 14400000,
      })
      .then((r: any) => {
        if (r.data && r.data[0]) {
          return r.data[0];
        }
        return r;
      });
  }

  async getPublicUrl(fileName: string): Promise<any | Error> {
    await this._storage.bucket(this._activeBucket).file(fileName).isPublic();
    return this._storage.bucket(this._activeBucket).file(fileName).baseUrl;
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

  async rename(currentFilename: string, newFilename: string): Promise<boolean | Error> {
    await this._storage
      .bucket(this._activeBucket)
      .file(currentFilename)
      .move(newFilename);
    return true;
  }

  async moveToFolder(filename: string, newFolder: string): Promise<boolean | Error> {
    throw new Error('Method not implemented!');
  }

  async moveToFolderAndRename(
    currentFilename: string,
    newFilename: string,
    newFolder: string,
  ): Promise<boolean | Error> {
    throw new Error('Method not implemented!');
  }
}
