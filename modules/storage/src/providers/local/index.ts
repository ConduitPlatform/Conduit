import { IStorageProvider, StorageConfig } from '../../interfaces';
import {
  constants,
  chmod,
  accessSync,
  access,
  existsSync,
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
  rmSync,
  statSync,
} from 'fs';
import { resolve } from 'path';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

export class LocalStorage implements IStorageProvider {
  _rootStoragePath: string;
  _storagePath: string;
  _activeContainer: string;

  constructor(options?: StorageConfig) {
    this._activeContainer = '';
    this._rootStoragePath = options && options.local ? options.local.storagePath : '';
    this._storagePath = this._rootStoragePath;
    if (this._storagePath !== '') {
      try {
        accessSync(this._storagePath, constants.R_OK | constants.W_OK);
        ConduitGrpcSdk.Logger.log('Can read/write in ' + this._storagePath);
      } catch (err) {
        ConduitGrpcSdk.Logger.log('Can not  read/write in ' + this._storagePath);
        ConduitGrpcSdk.Logger.log('Changing permissions..');
        chmod(this._storagePath, 0o600, () => {
          ConduitGrpcSdk.Logger.log('Permissions changed');
        });
      }
    }
  }

  deleteContainer(name: string): Promise<boolean | Error> {
    return this.deleteFolder(name);
  }

  deleteFolder(name: string): Promise<boolean | Error> {
    const self = this;
    let path = self._storagePath + '/' + self._activeContainer + '/';

    if (name !== self._activeContainer) {
      path += name;
    }

    return new Promise(function (res, reject) {
      try {
        rmSync(resolve(path), { recursive: true });
        ConduitGrpcSdk.Metrics?.decrement('folders_total');
        ConduitGrpcSdk.Metrics?.decrement('containers_total');
        res(true);
      } catch (e) {
        reject(e);
      }
    });
  }

  get(fileName: string): Promise<Buffer | Error> {
    const self = this;
    let path = self._storagePath + '/' + self._activeContainer + '/';

    if (fileName !== self._activeContainer) {
      path += fileName;
    }
    if (!existsSync(resolve(path))) {
      return new Promise(function (res, reject) {
        reject(new Error('File does not exist'));
      });
    }
    return new Promise(function (res, reject) {
      readFile(resolve(path), function (err, data) {
        if (err) reject(err);
        else res(data);
      });
    });
  }

  store(fileName: string, data: any): Promise<boolean | Error> {
    const self = this;
    let path = self._storagePath + '/' + self._activeContainer + '/';

    if (fileName !== self._activeContainer) {
      path += fileName;
    }
    return new Promise(function (res, reject) {
      writeFile(resolve(path), data, function (err) {
        if (err) reject(err);
        else {
          ConduitGrpcSdk.Metrics?.increment('files_total');
          ConduitGrpcSdk.Metrics?.increment('storage_size_bytes_total', data.byteLength);
          res(true);
        }
      });
    });
  }

  async createFolder(name: string): Promise<boolean | Error> {
    const self = this;
    return new Promise(async function (res, reject) {
      let path = self._storagePath + '/' + self._activeContainer;
      const containerExists = await self.folderExists(self._activeContainer);
      if (!containerExists) {
        mkdir(path, function (err) {
          if (err) reject(err);
        });
      }
      if (self._activeContainer !== name) {
        path = self._storagePath + '/' + self._activeContainer + '/' + name;
        mkdir(resolve(path), function (err) {
          if (err) reject(err);
          else res(true);
        });
      }
      ConduitGrpcSdk.Metrics?.increment('folders_total');
      ConduitGrpcSdk.Metrics?.increment('containers_total');
      res(true);
    });
  }

  folderExists(name: string): Promise<boolean | Error> {
    const self = this;
    let path = self._storagePath + '/' + self._activeContainer + '/';

    if (name !== self._activeContainer) {
      path += name;
    }
    return new Promise(function (res) {
      access(resolve(path), function (err) {
        if (err) res(false);
        else res(true);
      });
    });
  }

  delete(fileName: string): Promise<boolean | Error> {
    const self = this;
    let path = self._storagePath + '/' + self._activeContainer + '/';
    if (fileName !== self._activeContainer) {
      path += fileName;
    }
    let fileSize = statSync(path).size;
    return new Promise(function (res, reject) {
      unlink(resolve(path), function (err) {
        if (err) reject(err);
        else {
          ConduitGrpcSdk.Metrics?.decrement('files_total');
          ConduitGrpcSdk.Metrics?.decrement('storage_size_bytes_total', fileSize);
          res(true);
        }
      });
    });
  }

  exists(fileName: string): Promise<boolean | Error> {
    const self = this;
    let path = self._storagePath + '/' + self._activeContainer + '/';

    if (fileName !== self._activeContainer) {
      path += fileName;
    }
    return new Promise(function (res) {
      if (!existsSync(resolve(path))) {
        res(false);
      } else {
        res(true);
      }
    });
  }

  rename(currentFilename: string, newFilename: string): Promise<boolean | Error> {
    const self = this;
    const path = self._storagePath + '/' + self._activeContainer + '/';

    return new Promise(function (res, reject) {
      rename(resolve(path, currentFilename), resolve(path, newFilename), function (err) {
        if (err) reject(err);
        else res(true);
      });
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
        },
      );
    });
  }

  moveToFolderAndRename(
    currentFilename: string,
    newFilename: string,
    newFolder: string,
  ): Promise<boolean | Error> {
    const self = this;
    return new Promise(function (res, reject) {
      rename(
        resolve(self._storagePath, currentFilename),
        resolve(self._rootStoragePath, newFolder, newFilename),
        function (err) {
          if (err) reject(err);
          else res(true);
        },
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
    this._activeContainer = name;
    return this;
  }

  containerExists(name: string): Promise<boolean | Error> {
    return this.folderExists(name);
  }

  createContainer(name: string): Promise<boolean | Error> {
    this._activeContainer = name;
    return this.createFolder(name);
  }

  moveToContainer(filename: string, newContainer: string): Promise<boolean | Error> {
    throw new Error('Method not implemented!| Error');
  }

  moveToContainerAndRename(
    currentFilename: string,
    newFilename: string,
    newContainer: string,
  ): Promise<boolean | Error> {
    throw new Error('Method not implemented!| Error');
  }
}
