import { FileHandlers } from '../handlers/file';
import ConduitGrpcSdk, {
  GrpcServer,
  RouterRequest,
  RouterResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import {
  _StorageContainer,
  _StorageFolder,
  File,
} from '../models'

let paths = require('./admin.json').functions;

export class AdminRoutes {
  constructor(
    readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly fileHandlers: FileHandlers
  ) {
    this.grpcSdk.admin
      .registerAdmin(server, paths, {
        createFile: this.fileHandlers.createFile.bind(this.fileHandlers),
        deleteFile: this.fileHandlers.deleteFile.bind(this.fileHandlers),
        getFile: this.fileHandlers.getFile.bind(this.fileHandlers),
        updateFile: this.fileHandlers.updateFile.bind(this.fileHandlers),
        getFileUrl: this.fileHandlers.getFileUrl.bind(this.fileHandlers),
        getFileData: this.fileHandlers.getFileData.bind(this.fileHandlers),
        createFolder: this.createFolder.bind(this),
        getFolders: this.getFolders.bind(this),
        getFiles: this.getFiles.bind(this),
        getContainers: this.getContainers.bind(this),
        createContainer: this.createContainer.bind(this),
        deleteFolder: this.deleteFolder.bind(this),
        deleteContainer: this.deleteContainer.bind(this),
      })
      .catch((err: Error) => {
        console.log('Failed to register admin routes for module');
        console.log(err);
      });
  }

  async createFolder(call: RouterRequest, callback: RouterResponse) {
    const { name, container, isPublic } = JSON.parse(call.request.params);
    if (isNil(name)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Name is required',
      });
    }
    if (isNil(container)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Container is required',
      });
    }
    let newName = (name.trim().slice(-1) !== '/') ? name.trim() + '/' : name.trim();
    let folder = await _StorageFolder.getInstance()
      .findOne({
        name: newName,
        container,
      });
    if (isNil(folder)) {
      folder = await _StorageFolder.getInstance()
        .create({
          name: newName,
          container,
          isPublic,
        });
      let exists = await this.fileHandlers.storage
        .container(container)
        .folderExists(newName);
      if (!exists) {
        await this.fileHandlers.storage.container(container).createFolder(newName);
      }
    } else {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Folder already exists',
      });
    }
    return callback(null, { result: JSON.stringify(folder) });
  }

  async deleteFolder(call: RouterRequest, callback: RouterResponse) {
    const { name, container } = JSON.parse(call.request.params);

    if (isNil(name)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Name is required',
      });
    }
    let newName = (name.trim().slice(-1) !== '/') ? name.trim() + '/' : name.trim();
    if (isNil(container)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Container is required',
      });
    }
    let folder = await _StorageFolder.getInstance()
      .findOne({
        name: newName,
        container,
      });
    if (isNil(folder)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Folder does not exist',
      });
    } else {
      await this.fileHandlers.storage.container(container).deleteFolder(name);
      await _StorageFolder.getInstance()
      .deleteOne({
        name: newName,
        container,
      });
      await File.getInstance()
        .deleteMany({
          folder: newName,
          container,
        });
    }
    return callback(null, { result: 'OK' });
  }

  async createContainer(call: RouterRequest, callback: RouterResponse) {
    const { name, isPublic } = JSON.parse(call.request.params);

    if (isNil(name)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Name is required',
      });
    }
    try {
      let container = await _StorageContainer.getInstance()
        .findOne({
          name,
        });
      if (isNil(container)) {
        let exists = await this.fileHandlers.storage.containerExists(name);
        if (!exists) {
          await this.fileHandlers.storage.createContainer(name);
        }
        container = await _StorageContainer.getInstance()
          .create({
            name,
            isPublic,
          });
      } else {
        return callback({
          code: status.INVALID_ARGUMENT,
          message: 'Container already exists',
        });
      }
      return callback(null, { result: JSON.stringify(container) });
    } catch (e) {
      return callback({
        code: status.INTERNAL,
        message: e.message ?? 'Something went wrong',
      });
    }
  }

  async deleteContainer(call: RouterRequest, callback: RouterResponse) {
    const { name } = JSON.parse(call.request.params);

    if (isNil(name)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Name is required',
      });
    }
    try {
      let container = await _StorageContainer.getInstance()
        .findOne({
          name,
        });
      if (isNil(container)) {
        return callback({
          code: status.INVALID_ARGUMENT,
          message: 'Container does not exist',
        });
      } else {
        await this.fileHandlers.storage.deleteContainer(name);
        await _StorageContainer.getInstance()
          .deleteOne({
            name,
          });
        await File.getInstance()
          .deleteMany({
            container: name,
          });
        await _StorageFolder.getInstance()
          .deleteMany({
            container:name,
          });
      }
      return callback(null, { result: JSON.stringify(container) });
    } catch (e) {
      return callback({
        code: status.INTERNAL,
        message: e.message ?? 'Something went wrong',
      });
    }
  }

  async getFolders(call: RouterRequest, callback: RouterResponse) {
    const { skip, limit, container, parent } = JSON.parse(call.request.params);
    if (isNil(skip) || isNil(limit)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Skip and limit are required',
      });
    }
    let query: { container: string; name?: any } = {
      container,
    };
    if (!isNil(parent)) {
      query.name = { $regex: `${parent}\/\w+`, $options: 'i' };
    }

    let folders = await _StorageFolder.getInstance()
      .findMany(
        query,
        undefined,
        skip,
        limit
      );
    let folderCount = await _StorageFolder.getInstance().countDocuments(query);

    return callback(null, { result: JSON.stringify({ folders, folderCount }) });
  }

  async getContainers(call: RouterRequest, callback: RouterResponse) {
    const { skip, limit } = JSON.parse(call.request.params);
    if (isNil(skip) || isNil(limit)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Skip and limit are required',
      });
    }

    let containers = await _StorageContainer.getInstance()
      .findMany(
        {},
        undefined,
        skip,
        limit
      );
    let containersCount = await _StorageContainer.getInstance().countDocuments({});

    return callback(null, { result: JSON.stringify({ containers, containersCount }) });
  }

  async getFiles(call: RouterRequest, callback: RouterResponse) {
    const { skip, limit, folder, container, search } = JSON.parse(call.request.params);
    if (isNil(skip) || isNil(limit)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Skip and limit are required',
      });
    }

    if (isNil(container)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Container is required',
      });
    }

    let query: { container: string; folder?: string | null; name?: any } = { container };

    if (!isNil(folder)) {
      query.folder =  (folder.trim().slice(-1) !== '/') ? folder.trim() + '/' : folder.trim();
    } else {
      query.folder = null;
    }
    if (!isNil(search)) {
      query.name = { $regex: `.*${search}.*`, $options: 'i' };
    }

    let files = await File.getInstance()
      .findMany(
        query,
        undefined,
        skip,
        limit
      );
    let filesCount = await File.getInstance().countDocuments(query);

    return callback(null, { result: JSON.stringify({ files, filesCount }) });
  }
}
