import { IStorageProvider } from '../../interfaces';
import { StorageConfig } from '../../interfaces';
import { access, existsSync, mkdir, readFile, rename, unlink, writeFile } from 'fs';
import { resolve } from 'path';

export class LocalStorage implements IStorageProvider {
  _rootStoragePath: string;
  _storagePath: string;

  constructor(options?: StorageConfig) {
    this._rootStoragePath = options && options.storagePath ? options.storagePath : '';
    this._storagePath = this._rootStoragePath;
  }

  deleteContainer(name: string): Promise<boolean | Error> {
    throw new Error('Method not implemented.');
  }
  deleteFolder(name: string): Promise<boolean | Error> {
    throw new Error('Method not implemented.');
  }

  get(fileName: string): Promise<Buffer | Error> {
    if (!existsSync(resolve(this._storagePath, fileName))) {
      return new Promise(function (res, reject) {
        reject(new Error('File does not exist'));
      });
    }
    const self = this;
    return new Promise(function (res, reject) {
      readFile(resolve(self._storagePath, fileName), function (err, data) {
        if (err) reject(err);
        else res(data);
      });
    });
  }

  store(fileName: string, data: any): Promise<boolean | Error> {
    const self = this;
    return new Promise(function (res, reject) {
      writeFile(resolve(self._storagePath, fileName), data, function (err) {
        if (err) reject(err);
        else res(true);
      });
    });
  }

  createFolder(name: string): Promise<boolean | Error> {
    const self = this;
    return new Promise(function (res, reject) {
      mkdir(resolve(self._storagePath, name), function (err) {
        if (err) reject(err);
        else res(true);
      });
    });
  }

  folderExists(name: string): Promise<boolean | Error> {
    const self = this;
    return new Promise(function (res, reject) {
      access(resolve(self._storagePath, name), function (err) {
        if (err) reject(err);
        else res(true);
      });
    });
  }

  delete(fileName: string): Promise<boolean | Error> {
    const self = this;
    return new Promise(function (res, reject) {
      unlink(resolve(self._storagePath, fileName), function (err) {
        if (err) reject(err);
        else res(true);
      });
    });
  }

  exists(fileName: string): Promise<boolean | Error> {
    const self = this;
    return new Promise(function (res) {
      if (!existsSync(resolve(self._storagePath, fileName))) {
        res(false);
      } else {
        res(true);
      }
    });
  }

  rename(currentFilename: string, newFilename: string): Promise<boolean | Error> {
    const self = this;
    return new Promise(function (res, reject) {
      rename(
        resolve(self._storagePath, currentFilename),
        resolve(self._storagePath, newFilename),
        function (err) {
          if (err) reject(err);
          else res(true);
        }
      );
    });
  }

  moveToFolder(filename: string, newFolder: string): Promise<boolean | Error> {
    const self = this;
    return new Promise(function (res, reject) {
      rename(
        resolve(self._storagePath, filename),
        resolve(self._rootStoragePath, newFolder, filename),
        function (err) {
          if (err) reject(err);
          else res(true);
        }
      );
    });
  }

  moveToFolderAndRename(
    currentFilename: string,
    newFilename: string,
    newFolder: string
  ): Promise<boolean | Error> {
    const self = this;
    return new Promise(function (res, reject) {
      rename(
        resolve(self._storagePath, currentFilename),
        resolve(self._rootStoragePath, newFolder, newFilename),
        function (err) {
          if (err) reject(err);
          else res(true);
        }
      );
    });
  }

  getPublicUrl(fileName: string): Promise<any | Error> {
    throw new Error('Method not implemented!');
  }

  getSignedUrl(fileName: string): Promise<any> {
    throw new Error('Method not implemented!| Error');
  }

  container(name: string): IStorageProvider {
    throw new Error('Method not implemented!| Error');
  }

  containerExists(name: string): Promise<boolean | Error> {
    throw new Error('Method not implemented!| Error');
  }

  createContainer(name: string): Promise<boolean | Error> {
    throw new Error('Method not implemented!| Error');
  }

  moveToContainer(filename: string, newContainer: string): Promise<boolean | Error> {
    throw new Error('Method not implemented!| Error');
  }

  moveToContainerAndRename(
    currentFilename: string,
    newFilename: string,
    newContainer: string
  ): Promise<boolean | Error> {
    throw new Error('Method not implemented!| Error');
  }
}
