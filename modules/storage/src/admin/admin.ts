import { FileHandlers } from '../handlers/file';
import ConduitGrpcSdk, {
  GrpcServer,
  RouterRequest,
  RouterResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';

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
        createFolder: this.createFolder.bind(this),
        getFolders: this.getFolders.bind(this),
        getFiles: this.getFiles.bind(this),
        getContainers: this.getContainers.bind(this),
        createContainer: this.createContainer.bind(this),
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
    let folder = await this.grpcSdk.databaseProvider!.findOne('_StorageFolder', {
      name,
      container,
    });
    if (isNil(folder)) {
      folder = await this.grpcSdk.databaseProvider!.create('_StorageFolder', {
        name,
        container,
        isPublic,
      });
      let exists = await this.fileHandlers.storage
        .container(container)
        .folderExists(name);
      if (!exists) {
        await this.fileHandlers.storage.container(container).createFolder(name);
      }
    } else {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Folder already exists',
      });
    }
    return callback(null, { result: JSON.stringify(folder) });
  }

  async createContainer(call: RouterRequest, callback: RouterResponse) {
    const { name, isPublic } = JSON.parse(call.request.params);

    if (isNil(name)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Name is required',
      });
    }
    let container = await this.grpcSdk.databaseProvider!.findOne('_StorageContainer', {
      name,
    });
    if (isNil(container)) {
      container = await this.grpcSdk.databaseProvider!.create('_StorageContainer', {
        name,
        isPublic,
      });
      let exists = await this.fileHandlers.storage.containerExists(container);
      if (!exists) {
        await this.fileHandlers.storage.createContainer(container);
      }
    } else {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Container already exists',
      });
    }
    return callback(null, { result: JSON.stringify(container) });
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

    let folders = await this.grpcSdk.databaseProvider!.findMany(
      '_StorageFolder',
      query,
      undefined,
      skip,
      limit
    );
    let folderCount = await this.grpcSdk.databaseProvider!.countDocuments(
      '_StorageFolder',
      query
    );

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

    let containers = await this.grpcSdk.databaseProvider!.findMany(
      '_StorageContainer',
      {},
      undefined,
      skip,
      limit
    );
    let containersCount = await this.grpcSdk.databaseProvider!.countDocuments(
      '_StorageContainer',
      {}
    );

    return callback(null, { result: JSON.stringify({ containers, containersCount }) });
  }

  async getFiles(call: RouterRequest, callback: RouterResponse) {
    const { skip, limit, folder, container } = JSON.parse(call.request.params);
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

    let query: { container: string; folder?: string } = { container };

    if (!isNil(folder)) {
      query.folder = folder;
    }

    let files = await this.grpcSdk.databaseProvider!.findMany(
      'File',
      query,
      undefined,
      skip,
      limit
    );
    let filesCount = await this.grpcSdk.databaseProvider!.countDocuments('File', query);

    return callback(null, { result: JSON.stringify({ files, filesCount }) });
  }
}
