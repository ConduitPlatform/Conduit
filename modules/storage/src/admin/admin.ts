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
    let folder = await this.database.findOne('Folder', { name });
    if (isNil(folder)) {
      folder = await this.database.create('Folder', { name, isPublic });
      let exists = await this.fileHandlers.storage.folderExists(name);
      if (!exists) {
        await this.fileHandlers.storage.createFolder(name);
      }
    } else {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Folder already exists',
      });
    }
    return callback(null, { result: JSON.stringify(folder) });
  }

  async getFolders(call: RouterRequest, callback: RouterResponse) {
    const { skip, limit } = JSON.parse(call.request.params);
    if (isNil(skip) || isNil(limit)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Skip and limit are required',
      });
    }

    let folders = await this.database.findMany('Folder', {}, undefined, skip, limit);
    let folderCount = await this.database.countDocuments('Folder', {});

    return callback(null, { result: JSON.stringify({ folders, folderCount }) });
  }

  async getFiles(call: RouterRequest, callback: RouterResponse) {
    const { skip, limit, folder } = JSON.parse(call.request.params);
    if (isNil(skip) || isNil(limit)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Skip and limit are required',
      });
    }

    if (isNil(folder)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'folder is required',
      });
    }

    let files = await this.database.findMany('File', { folder }, undefined, skip, limit);
    let filesCount = await this.database.countDocuments('File', { folder });

    return callback(null, { result: JSON.stringify({ files, filesCount }) });
  }
}
