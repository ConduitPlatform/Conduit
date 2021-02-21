import { IStorageProvider } from '../../interfaces/IStorageProvider';
import { StorageConfig } from '../../interfaces/StorageConfig';

const { Storage } = require('@google-cloud/storage');

export class GoogleCloudStorage implements IStorageProvider {
  _storage: Storage;
  _activeBucket: string = '';

  constructor(options: StorageConfig) {
    this._storage = new Storage({ keyFilename: options.google.serviceAccountKeyPath });
  }

  /**
   * Used to create a new bucket
   * @param name For the bucket
   */
  async createFolder(name: string): Promise<boolean | Error> {
    // Creates the new bucket
    await this._storage.createBucket(name);
    this._activeBucket = name;
    return true;
  }

  /**
   * Used to switch the current bucket.
   * Ex. storage.bucket('photos').file('test')
   * @param name For the bucket
   */
  folder(name: string): IStorageProvider {
    this._activeBucket = name;
    return this;
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
    return this._storage.bucket(this._activeBucket).file(fileName).publicUrl();
  }

  async store(
    fileName: string,
    data: any,
    isPublic: boolean = false
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
    let newBucketFile = this._storage.bucket(newFolder).file(filename);
    await this._storage.bucket(this._activeBucket).file(filename).move(newBucketFile);
    return true;
  }

  async moveToFolderAndRename(
    currentFilename: string,
    newFilename: string,
    newFolder: string
  ): Promise<boolean | Error> {
    let newBucketFile = this._storage.bucket(newFolder).file(newFilename);
    await this._storage
      .bucket(this._activeBucket)
      .file(currentFilename)
      .move(newBucketFile);
    return true;
  }
}
