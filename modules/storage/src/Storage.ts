import ConduitGrpcSdk, {
  ConfigController,
  DatabaseProvider,
  GrpcCallback,
  HealthCheckStatus,
  ManagedModule,
  ParsedRouterRequest,
} from '@conduitplatform/grpc-sdk';
import AppConfigSchema, { Config } from './config';
import { AdminRoutes } from './admin';
import { FileHandlers } from './handlers/file';
import { StorageRoutes } from './routes';
import * as models from './models';
import path from 'path';
import { status } from '@grpc/grpc-js';
import { isEmpty, isNil } from 'lodash';
import { runMigrations } from './migrations';
import { FileResponse, GetFileDataResponse } from './protoTypes/storage';
import MetricsSchema from './metrics';
import { IStorageProvider } from './interfaces';
import { createStorageProvider } from './providers';
import { getAwsAccountId } from './utils';

export default class Storage extends ManagedModule<Config> {
  configSchema = AppConfigSchema;
  protected metricsSchema = MetricsSchema;
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
    await this.grpcSdk.waitForExistence('database');
    this.database = this.grpcSdk.databaseProvider!;
    await this.registerSchemas();
    await runMigrations(this.grpcSdk);
    this.storageProvider = createStorageProvider('local', {} as Config);
    this._fileHandlers = new FileHandlers(this.grpcSdk, this.storageProvider);
  }

  async preConfig(config: Config) {
    if (config.provider === 'aws') {
      if (isEmpty(config.aws)) throw new Error('Missing AWS config');
      if (isNil(config.aws.accountId)) {
        config.aws.accountId = await getAwsAccountId(config);
      }
    }
    return config;
  }

  async onConfig() {
    if (!ConfigController.getInstance().config.active) {
      this.updateHealth(HealthCheckStatus.NOT_SERVING);
    } else {
      await this.grpcSdk.monitorModule(
        'authentication',
        serving => {
          this.enableAuthRoutes = serving;
          this.refreshAppRoutes();
        },
        false,
      );
      const { provider, local, google, azure, aws, aliyun } =
        ConfigController.getInstance().config;
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
    this.grpcSdk
      .waitForExistence('router')
      .then(() => {
        this.userRouter = new StorageRoutes(
          this.grpcServer,
          this.grpcSdk,
          this._fileHandlers,
          this.enableAuthRoutes,
        );
        return this.userRouter.registerRoutes();
      })
      .catch(e => {
        ConduitGrpcSdk.Logger.error(e.message);
      });
  }

  protected registerSchemas() {
    const promises = Object.values(models).map(model => {
      const modelInstance = model.getInstance(this.database);
      if (Object.keys(modelInstance.fields).length !== 0) {
        // borrowed foreign model
        return this.database
          .createSchemaFromAdapter(modelInstance)
          .then(() => this.database.migrate(modelInstance.name));
      }
    });
    return Promise.all(promises);
  }

  async initializeMetrics() {
    const containersTotal = await models._StorageContainer
      .getInstance()
      .countDocuments({});
    const foldersTotal = await models._StorageFolder.getInstance().countDocuments({});
    const files = await models.File.getInstance().findMany({}, 'size');
    let filesTotalSize = 0;
    if (files.length > 0) {
      filesTotalSize = files
        .map(file => file.size)
        .reduce((prev, next) => {
          return prev + next;
        });
    }
    ConduitGrpcSdk.Metrics?.set('containers_total', containersTotal);
    ConduitGrpcSdk.Metrics?.set('folders_total', foldersTotal);
    ConduitGrpcSdk.Metrics?.set('files_total', files.length);
    ConduitGrpcSdk.Metrics?.set('storage_size_bytes_total', filesTotalSize);
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
  // TODO: This needs to be changed too & add updateData
  async updateFile(call: ParsedRouterRequest, callback: GrpcCallback<FileResponse>) {
    if (!this._fileHandlers)
      return callback({
        code: status.INTERNAL,
        message: 'File handlers not initiated',
      });
    await this._fileHandlers.updateFile(call);
  }
}
