import {
  createStorageProvider,
  IStorageProvider,
} from "@quintessential-sft/storage-provider";
import File from "./models/File";
import StorageConfigSchema from "./config";
import { isNil } from "lodash";
import ConduitGrpcSdk, {
  grpcModule,
} from "@quintessential-sft/conduit-grpc-sdk";
import * as grpc from "grpc";
import * as path from "path";
import { FileHandlers } from "./handlers/file";
import { FileRoutes } from "./routes/file";

let protoLoader = require("@grpc/proto-loader");

export class StorageModule {
  private storageProvider: IStorageProvider;
  private isRunning: boolean = false;
  private readonly _url: string;
  private _fileHandlers: FileHandlers;
  private grpcServer: any;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    var packageDefinition = protoLoader.loadSync(
      path.resolve(__dirname, "./storage.proto"),
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      }
    );
    var protoDescriptor = grpcModule.loadPackageDefinition(packageDefinition);

    var storage = protoDescriptor.storage.Storage;
    this.grpcServer = new grpcModule.Server();

    this.grpcServer.addService(storage.service, {
      setConfig: this.setConfig.bind(this),
      getFile: this.getFileGrpc.bind(this),
      createFile: this.createFileGrpc.bind(this),
      updateFile: this.updateFileGrpc.bind(this),
    });
    this._url = process.env.SERVICE_URL || "0.0.0.0:0";
    let result = this.grpcServer.bind(
      this._url,
      grpcModule.ServerCredentials.createInsecure(),
      {
        "grpc.max_receive_message_length": 1024 * 1024 * 100,
        "grpc.max_send_message_length": 1024 * 1024 * 100,
      }
    );
    this._url = process.env.SERVICE_URL || "0.0.0.0:" + result;
    console.log("bound on:", this._url);
    this.storageProvider = createStorageProvider("local", {} as any);
    this._fileHandlers = new FileHandlers(this.grpcSdk, this.storageProvider);
    let files = new FileRoutes(
      this.grpcServer,
      this.grpcSdk,
      this.storageProvider,
      this._fileHandlers
    );
    this._routes = files.registeredRoutes;
    this.grpcServer.start();
    this.grpcSdk
      .waitForExistence("database-provider")
      .then(() => {
        return this.grpcSdk.initializeEventBus();
      })
      .then(() => {
        const self = this;
        this.grpcSdk.bus?.subscribe("storage", (message: string) => {
          if (message === "config-update") {
            this.enableModule()
              .then((r) => {
                console.log("Updated storage configuration");
              })
              .catch((e: Error) => {
                console.log("Failed to update email config");
              });
          }
        });
      })
      .catch(() => {
        console.log("Bus did not initialize!");
      })
      .then(() => {
        return this.grpcSdk.config.get("storage");
      })
      .catch(() => {
        return this.grpcSdk.config.updateConfig(
          StorageConfigSchema.getProperties(),
          "storage"
        );
      })
      .then((storageConfig: any) => {
        return this.grpcSdk.config.addFieldstoConfig(
          StorageConfigSchema.getProperties(),
          "storage"
        );
      })
      .catch(() => {
        console.log("storage config did not update");
      })
      .then((storageConfig: any) => {
        if (storageConfig.active) {
          return this.enableModule();
        }
      })
      .catch(console.log);
  }

  private _routes: any[];

  get routes() {
    return this._routes;
  }

  get url() {
    return this._url;
  }

  async setConfig(call: any, callback: any) {
    const newConfig = JSON.parse(call.request.newConfig);
    if (!StorageConfigSchema.load(newConfig).validate()) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: "Invalid configuration values",
      });
    }

    let errorMessage: string | null = null;
    const updateResult = await this.grpcSdk.config
      .updateConfig(newConfig, "storage")
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    const storageConfig = await this.grpcSdk.config.get("storage");
    if (storageConfig.active) {
      await this.enableModule().catch((e: Error) => (errorMessage = e.message));
      if (!isNil(errorMessage))
        return callback({ code: grpc.status.INTERNAL, message: errorMessage });
      this.grpcSdk.bus?.publish("storage", "config-update");
    } else {
      return callback({
        code: grpc.status.FAILED_PRECONDITION,
        message: "Module is not active",
      });
    }
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    return callback(null, { updatedConfig: JSON.stringify(updateResult) });
  }

  async getFileGrpc(call: any, callback: any) {
    if (!this._fileHandlers)
      return callback({
        code: grpc.status.INTERNAL,
        message: "File handlers not initiated",
      });
    await this._fileHandlers.getFile(call, callback);
  }

  async createFileGrpc(call: any, callback: any) {
    if (!this._fileHandlers)
      return callback({
        code: grpc.status.INTERNAL,
        message: "File handlers not initiated",
      });
    await this._fileHandlers.createFile(call, callback);
  }

  async updateFileGrpc(call: any, callback: any) {
    if (!this._fileHandlers)
      return callback({
        code: grpc.status.INTERNAL,
        message: "File handlers not initiated",
      });

    await this._fileHandlers.updateFile(call, callback);
  }

  private async enableModule(): Promise<any> {
    const storageConfig = await this.grpcSdk.config.get("storage");
    const { provider, storagePath, google, azure } = storageConfig;

    if (!this.isRunning) {
      this.registerModels();
      this.isRunning = true;
    }
    this.storageProvider = createStorageProvider(provider, {
      storagePath,
      google,
      azure,
    });
    this._fileHandlers.updateProvider(this.storageProvider);
  }

  private registerModels(): any {
    return this.grpcSdk.databaseProvider!.createSchemaFromAdapter(File);
  }
}
