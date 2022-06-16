import {
  ManagedModule,
  DatabaseProvider,
  ConfigController,
  HealthCheckStatus,
  GrpcCallback,
  ParsedRouterRequest,
} from '@conduitplatform/grpc-sdk';
import AppConfigSchema, { Config } from './config';
import { AdminRoutes } from './admin';
import { FileHandlers } from './handlers/file';
import { StorageRoutes } from './routes/routes';
import { createStorageProvider, IStorageProvider } from './storage-provider';
import * as models from './models';
import path from 'path';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash';
import { getAwsAccountId } from './storage-provider/utils/utils';
import { isEmpty } from 'lodash';
import { runMigrations } from './migrations';
import { FileResponse, GetFileDataResponse } from './protoTypes/storage';

type Callback = (arg1: { code: number; message: string }) => void;

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
  private adminRouter: AdminRoutes;
  private userRouter: StorageRoutes;
  private database: DatabaseProvider;
  private storageProvider: IStorageProvider;
  private _fileHandlers: FileHandlers;
  private enableAuthRoutes: boolean = false;

  constructor() {
    super('storage');
    this.updateHealth(HealthCheckStatus.UNKNOWN, true);
  }

  async onServerStart() {
    this.database = this.grpcSdk.databaseProvider!;
    await runMigrations(this.grpcSdk);
    this.storageProvider = createStorageProvider('local', {} as Config);
    this._fileHandlers = new FileHandlers(this.grpcSdk, this.storageProvider);
    await this.registerSchemas();
    await this.grpcSdk.monitorModule(
      'authentication',
      serving => {
        this.enableAuthRoutes = serving;
        this.refreshAppRoutes();
      },
      false,
    );
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
    if (!ConfigController.getInstance().config.active) {
      this.updateHealth(HealthCheckStatus.NOT_SERVING);
    } else {
      await this.updateConfig();
      const storageConfig = ConfigController.getInstance().config;
      const { provider, local, google, azure, aws, aliyun } = storageConfig;
      this.storageProvider = createStorageProvider(provider, {
        local,
        google,
        azure,
        aws,
        aliyun,
      });
      this._fileHandlers.updateProvider(this.storageProvider);
      this.adminRouter = new AdminRoutes(
        this.grpcServer,
        this.grpcSdk,
        this._fileHandlers,
      );
      await this.refreshAppRoutes();
      this.updateHealth(HealthCheckStatus.SERVING);
    }
  }

  private async refreshAppRoutes() {
    this.userRouter = new StorageRoutes(
      this.grpcServer,
      this.grpcSdk,
      this._fileHandlers,
      this.enableAuthRoutes,
    );
    await this.userRouter.registerRoutes();
  }

  protected registerSchemas() {
    const promises = Object.values(models).map(model => {
      const modelInstance = model.getInstance(this.database);
      if (Object.keys(modelInstance.fields).length !== 0) {
        // borrowed foreign model
        return this.database.createSchemaFromAdapter(modelInstance);
      }
    });
    return Promise.all(promises);
  }

  // gRPC Service
  async getFile(call: ParsedRouterRequest, callback: GrpcCallback<FileResponse>) {
    if (!this._fileHandlers)
      return callback({
        code: status.INTERNAL,
        message: 'File handlers not initiated',
      });
    await this._fileHandlers.getFile(call);
  }

  async getFileData(
    call: ParsedRouterRequest,
    callback: GrpcCallback<GetFileDataResponse>,
  ) {
    if (!this._fileHandlers)
      return callback({
        code: status.INTERNAL,
        message: 'File handlers not initiated',
      });
    await this._fileHandlers.getFileData(call);
  }

  async createFile(call: ParsedRouterRequest, callback: GrpcCallback<FileResponse>) {
    if (!this._fileHandlers)
      return callback({
        code: status.INTERNAL,
        message: 'File handlers not initiated',
      });
    await this._fileHandlers.createFile(call);
  }

  async updateFile(call: ParsedRouterRequest, callback: GrpcCallback<FileResponse>) {
    if (!this._fileHandlers)
      return callback({
        code: status.INTERNAL,
        message: 'File handlers not initiated',
      });
    await this._fileHandlers.updateFile(call);
  }
}
