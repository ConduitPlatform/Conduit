import { FileHandlers } from '../handlers/file';
import ConduitGrpcSdk, { GrpcServer } from '@quintessential-sft/conduit-grpc-sdk';

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
      })
      .catch((err: Error) => {
        console.log('Failed to register admin routes for module');
        console.log(err);
      });
  }
}
