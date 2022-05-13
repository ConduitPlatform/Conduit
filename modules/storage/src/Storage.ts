import {
  ManagedModule,
  DatabaseProvider,
  ConfigController,
  ParsedRouterRequest,
} from '@conduitplatform/grpc-sdk';
import AppConfigSchema, { Config } from './config';
import { AdminRoutes } from './admin/admin';
import { FileHandlers } from './handlers/file';
import { StorageRoutes } from './routes/routes';
import { createStorageProvider, IStorageProvider } from './storage-provider';
import * as models from './models';
import { migrateFoldersToContainers } from './migrations/container.migrations';
import path from 'path';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash';
import { getAwsAccountId } from './storage-provider/utils/utils';
import { isEmpty } from 'lodash';

type ResponseError = (arg1: { code: number; message: string }) => void;
type ReponseSuccess = (arg1: null, arg2: { [field: string]: any }) => void;
type Callback = ReponseSuccess & ResponseError;

export default class Storage extends ManagedModule<Config> {
  config = AppConfigSchema;
  service = {
    protoPath: path.resolve(__dirname, 'storage.proto'),
    protoDescription: 'storage.Storage',
    functions: {
      setConfig: this.setConfig.bind(this),
      getFile: this.getFile.bind(this),
      createFile: this.createFile.bind(this),
      updateFile: this.updateFile.bind(this),
      getFileData: this.getFileData.bind(this),
    },
  };
  private isRunning: boolean = false;
  private adminRouter: AdminRoutes;
  private userRouter: StorageRoutes;
  private database: DatabaseProvider;
  private storageProvider: IStorageProvider;
  private _fileHandlers: FileHandlers;

  constructor() {
    super('storage');
  }

  async onServerStart() {
    await this.grpcSdk.waitForExistence('database');
    this.database = this.grpcSdk.databaseProvider!;
    this.storageProvider = createStorageProvider('local', {} as Config);
  }

  async preConfig(config: Config) {
    if (config.provider === 'aws') {
      if (isEmpty(config.aws)) throw new Error('Missing AWS config');
      if (isNil(config.aws.accountId)) {
        config.aws.accountId = (await getAwsAccountId(config)) as any;
      }
    }
    return config;
  }

  async onConfig() {
    await this.updateConfig();
    const storageConfig = ConfigController.getInstance().config;
    const { provider, local, google, azure, aws } = storageConfig;

    if (!this.isRunning) {
      await this.registerSchemas();
      await migrateFoldersToContainers(this.grpcSdk);
      this.isRunning = true;
    }
    this.storageProvider = createStorageProvider(provider, {
      local,
      google,
      azure,
      aws,
    });
    this._fileHandlers = new FileHandlers(this.grpcSdk, this.storageProvider);
    this.userRouter = new StorageRoutes(
      this.grpcServer,
      this.grpcSdk,
      this._fileHandlers
    );
    this.adminRouter = new AdminRoutes(this.grpcServer, this.grpcSdk, this._fileHandlers);
    this._fileHandlers.updateProvider(this.storageProvider);
    await this.userRouter.registerRoutes();
  }

  protected registerSchemas() {
    const promises = Object.values(models).map((model: any) => {
      const modelInstance = model.getInstance(this.database);
      if (Object.keys(modelInstance.fields).length !== 0) {
        // borrowed foreign model
        return this.database.createSchemaFromAdapter(modelInstance);
      }
    });
    return Promise.all(promises);
  }

  // gRPC Service
  async getFile(call: ParsedRouterRequest, callback: Callback) {
    if (!this._fileHandlers)
      return callback({
        code: status.INTERNAL,
        message: 'File handlers not initiated',
      });
    await this._fileHandlers.getFile(call);
  }

  async getFileData(call: ParsedRouterRequest, callback: Callback) {
    if (!this._fileHandlers)
      return callback({
        code: status.INTERNAL,
        message: 'File handlers not initiated',
      });
    await this._fileHandlers.getFileData(call);
  }

  async createFile(call: ParsedRouterRequest, callback: Callback) {
    if (!this._fileHandlers)
      return callback({
        code: status.INTERNAL,
        message: 'File handlers not initiated',
      });
    await this._fileHandlers.createFile(call);
  }

  async updateFile(call: ParsedRouterRequest, callback: Callback) {
    if (!this._fileHandlers)
      return callback({
        code: status.INTERNAL,
        message: 'File handlers not initiated',
      });
    await this._fileHandlers.updateFile(call);
  }
}
