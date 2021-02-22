import File from "../models/File";
import { FileHandlers } from "../handlers/file";
import { IStorageProvider } from "@quintessential-sft/storage-provider";
import grpc from "grpc";
import ConduitGrpcSdk, {
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  TYPE,
  constructRoute,
} from "@quintessential-sft/conduit-grpc-sdk";

var protoLoader = require("@grpc/proto-loader");
var PROTO_PATH = __dirname + "/router.proto";

export class FileRoutes {
  constructor(
    server: grpc.Server,
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly storageProvider: IStorageProvider,
    private readonly fileHandlers: FileHandlers
  ) {
    // this.registerMiddleware();
    var packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    var protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    // The protoDescriptor object has the full package hierarchy
    // @ts-ignore
    var router = protoDescriptor.storage.router.Router;
    server.addService(router.service, {
      createFile: this.fileHandlers.createFile.bind(this.fileHandlers),
      deleteFile: this.fileHandlers.deleteFile.bind(this.fileHandlers),
      getFile: this.fileHandlers.getFile.bind(this.fileHandlers),
      updateFile: this.fileHandlers.updateFile.bind(this.fileHandlers),
      getFileUrl: this.fileHandlers.getFileUrl.bind(this.fileHandlers),
    });
  }

  get registeredRoutes(): any[] {
    let routesArray: any = [];
    routesArray.push(
      constructRoute(
        new ConduitRoute(
          {
            bodyParams: {
              name: TYPE.String,
              mimeType: TYPE.String,
              data: TYPE.String,
              folder: TYPE.String,
              isPublic: TYPE.Boolean,
            },
            action: ConduitRouteActions.POST,
            path: "/storage/file",
            middlewares: ["authMiddleware"],
          },
          new ConduitRouteReturnDefinition("File", {
            _id: TYPE.String,
            name: TYPE.String,
            user: TYPE.ObjectId, // Hack because we don't have endpoints that return a user so the model is not defined TODO replace with relation
            mimeType: TYPE.String,
            folder: TYPE.String,
            createdAt: TYPE.String,
            updatedAt: TYPE.String,
          }),
          "createFile"
        )
      )
    );

    routesArray.push(
      constructRoute(
        new ConduitRoute(
          {
            urlParams: {
              id: TYPE.String,
            },
            action: ConduitRouteActions.GET,
            path: "/storage/file/:id",
          },
          new ConduitRouteReturnDefinition("FileWithData", {
            _id: TYPE.String,
            name: TYPE.String,
            user: TYPE.ObjectId,
            mimeType: TYPE.String,
            folder: TYPE.String,
            createdAt: TYPE.String,
            updatedAt: TYPE.String,
            data: TYPE.String,
          }),
          "getFile"
        )
      )
    );

    routesArray.push(
      constructRoute(
        new ConduitRoute(
          {
            urlParams: {
              id: TYPE.String,
            },
            action: ConduitRouteActions.GET,
            path: "/storage/getFileUrl/:id",
          },
          new ConduitRouteReturnDefinition("FileWithData", {
            _id: TYPE.String,
            name: TYPE.String,
            user: TYPE.ObjectId,
            mimeType: TYPE.String,
            folder: TYPE.String,
            createdAt: TYPE.String,
            updatedAt: TYPE.String,
            data: TYPE.String,
          }),
          "getFileUrl"
        )
      )
    );

    routesArray.push(
      constructRoute(
        new ConduitRoute(
          {
            urlParams: {
              id: TYPE.String,
            },
            action: ConduitRouteActions.DELETE,
            path: "/storage/file/:id",
            middlewares: ["authMiddleware"],
          },
          new ConduitRouteReturnDefinition("FileDeleteResponse", {
            success: TYPE.Boolean,
          }),
          "deleteFile"
        )
      )
    );

    routesArray.push(
      constructRoute(
        new ConduitRoute(
          {
            urlParams: {
              id: TYPE.String,
            },
            bodyParams: {
              name: TYPE.String,
              mimeType: TYPE.String,
              data: TYPE.String,
              folder: TYPE.String,
            },
            action: ConduitRouteActions.UPDATE,
            path: "/storage/file",
            middlewares: ["authMiddleware"],
          },
          new ConduitRouteReturnDefinition("FileUpdateResponse", {
            _id: TYPE.String,
            name: TYPE.String,
            user: TYPE.ObjectId,
            mimeType: TYPE.String,
            folder: TYPE.String,
            createdAt: TYPE.String,
            updatedAt: TYPE.String,
          }),
          "updateFile"
        )
      )
    );

    return routesArray;
  }
}
