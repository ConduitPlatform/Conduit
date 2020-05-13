import { createStorageProvider, IStorageProvider } from '@conduit/storage-provider';
import { FileRoutes } from './routes/file';
import File from './models/File';
import StorageConfigSchema from './config/storage';
import { isNil } from 'lodash';
import ConduitGrpcSdk, { grpcModule } from '@conduit/grpc-sdk';
import * as grpc from "grpc";
import * as path from 'path';
let protoLoader = require('@grpc/proto-loader');

export class StorageModule {
  private storageProvider: IStorageProvider;
  private isRunning: boolean = false;
  private readonly _url: string;

  constructor(
    private readonly grpcSdk: ConduitGrpcSdk
  ) {
    var packageDefinition = protoLoader.loadSync(
      path.resolve(__dirname, './storage.proto'),
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
      });
    var protoDescriptor = grpcModule.loadPackageDefinition(packageDefinition);

    var storage = protoDescriptor.storage.Storage;
    var server = new grpcModule.Server();

    server.addService(storage.service, {
      setConfig: this.setConfig.bind(this)
    });
    this._url = process.env.SERVICE_URL || '0.0.0.0:0';
    let result = server.bind(this._url, grpcModule.ServerCredentials.createInsecure());
    this._url = process.env.SERVICE_URL || ('0.0.0.0:' + result);
    console.log("bound on:", this._url);
    server.start();
    this.enableModule().catch(console.log)
  }

  get url() {
    return this._url;
  }

  static get config() {
    return StorageConfigSchema;
  }

  async setConfig(call: any, callback: any) {

    const newConfig = JSON.parse(call.request.newConfig);
    if (!ConduitGrpcSdk.validateConfig(newConfig, StorageConfigSchema.storage)) {
      return callback({code: grpc.status.INVALID_ARGUMENT, message: 'Invalid configuration values'});
    }

    let errorMessage: string | null = null;
    const updateResult = await this.grpcSdk.config.updateConfig(newConfig, 'storage').catch((e: Error) => errorMessage = e.message);
    if (!isNil(errorMessage)) {
      return callback({code: grpc.status.INTERNAL, message: errorMessage});
    }

    const storageConfig = await this.grpcSdk.config.get('storage');
    if (storageConfig.active) {
      await this.enableModule().catch((e: Error) => errorMessage = e.message);
    } else {
      return callback({code: grpc.status.FAILED_PRECONDITION, message: 'Module is not active'});
    }
    if (!isNil(errorMessage)) {
      return callback({code: grpc.status.INTERNAL, message: errorMessage});
    }

    return callback(null, {updatedConfig: JSON.stringify(updateResult)});
  }

  private async enableModule(): Promise<any> {
    await this.ensureDatabase();
    const storageConfig = await this.grpcSdk.config.get('storage');
    const { provider, storagePath, google } = storageConfig;

    if (!this.isRunning) {
      this.storageProvider = createStorageProvider(provider, { storagePath, google });
      this.registerModels();
      // this.registerRoutes();
      this.isRunning = true;
    } else {
      this.storageProvider = createStorageProvider(provider, { storagePath, google });
    }
  }

  private registerModels(): any {
    const database = this.grpcSdk.databaseProvider;
    if (isNil(database)) {
      return this.registerModels();
    }
    return database.createSchemaFromAdapter(File);
  }

  private async ensureDatabase(): Promise<any> {
    if (!this.grpcSdk.databaseProvider) {
      await this.grpcSdk.refreshModules(true);
      return this.ensureDatabase();
    }
  }

  // private registerRoutes() {
  //   new FileRoutes(this.conduit, this.storageProvider);
  // }
}
