import {
  ConduitGrpcSdk,
  DatabaseProvider,
  GrpcCallback,
  GrpcRequest,
  GrpcResponse,
  HealthCheckStatus,
  Indexable,
} from '@conduitplatform/grpc-sdk';
import AppConfigSchema, { Config } from './config/index.js';
import { AdminRoutes } from './admin/index.js';
import { FileHandlers } from './handlers/file.js';
import { StorageRoutes } from './routes/index.js';
import * as models from './models/index.js';
import path from 'path';
import { status } from '@grpc/grpc-js';
import { isEmpty, isNil } from 'lodash-es';
import { runMigrations } from './migrations/index.js';
import {
  CreateFileByUrlRequest,
  CreateFileRequest,
  DeleteFileResponse,
  FileByUrlResponse,
  FileResponse,
  GetFileDataResponse,
  GetFileRequest,
  GetFileUrlRequest,
  GetFileUrlResponse,
  UpdateFileByUrlRequest,
  UpdateFileRequest,
} from './protoTypes/storage.js';
import MetricsSchema from './metrics/index.js';
import { IStorageProvider } from './interfaces/index.js';
import { createStorageProvider } from './providers/index.js';
import { getAwsAccountId } from './utils/index.js';
import {
  ConfigController,
  createParsedRouterRequest,
  ManagedModule,
} from '@conduitplatform/module-tools';
import { StorageParamAdapter } from './adapter/StorageParamAdapter.js';
import { AdminFileHandlers } from './admin/adminFile.js';
import * as resources from './authz/index.js';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class Storage extends ManagedModule<Config> {
  configSchema = AppConfigSchema;
  service = {
    protoPath: path.resolve(__dirname, 'storage.proto'),
    protoDescription: 'storage.Storage',
    functions: {
      getFile: this.getFile.bind(this),
      getFileData: this.getFileData.bind(this),
      createFile: this.createFile.bind(this),
      updateFile: this.updateFile.bind(this),
      deleteFile: this.deleteFile.bind(this),
      createFileByUrl: this.createFileByUrl.bind(this),
      updateFileByUrl: this.updateFileByUrl.bind(this),
      getFileUrl: this.getFileUrl.bind(this),
    },
  };
  protected metricsSchema = MetricsSchema;
  private adminRouter: AdminRoutes;
  private userRouter: StorageRoutes;
  private database: DatabaseProvider;
  private storageProvider: IStorageProvider;
  private _fileHandlers: FileHandlers;
  private _adminFileHandlers: AdminFileHandlers;
  private enableAuthRoutes: boolean = false;
  private storageParamAdapter: StorageParamAdapter;

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
    this._adminFileHandlers = new AdminFileHandlers(this.grpcSdk, this.storageProvider);
    this.storageParamAdapter = new StorageParamAdapter();
  }

  async preConfig(config: Config) {
    if (config.provider === 'aws') {
      if (isEmpty(config.aws)) throw new Error('Missing AWS config');
      if (isNil(config.aws.accountId)) {
        config.aws.accountId = await getAwsAccountId(config);
      }
    }
    if (
      !isNil(
        (config as Config & { allowContainerCreation?: boolean }).allowContainerCreation,
      )
    ) {
      delete (config as Config & { allowContainerCreation?: boolean })
        .allowContainerCreation;
    }
    return config;
  }

  async onConfig() {
    const config = ConfigController.getInstance().config;
    if (!config.active) {
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
      const { provider, local, google, azure, aws, aliyun, authorization } = config;
      if (authorization.enabled) {
        this.grpcSdk.onceModuleUp('authorization', async () => {
          for (const resource of Object.values(resources)) {
            this.grpcSdk.authorization!.defineResource(resource);
          }
          const defaultContainer = await models._StorageContainer.getInstance().findOne({
            name: config.defaultContainer,
          });
          if (!defaultContainer) {
            await models._StorageContainer.getInstance().create({
              name: config.defaultContainer,
            });
          }
        });
      }
      this.storageProvider = createStorageProvider(provider, {
        local,
        google,
        azure,
        aws,
        aliyun,
      });
      this._fileHandlers.updateProvider(this.storageProvider);
      this._adminFileHandlers.updateProvider(this.storageProvider);
      this.adminRouter = new AdminRoutes(
        this.grpcServer,
        this.grpcSdk,
        this._adminFileHandlers,
      );
      await this.refreshAppRoutes();
      this.updateHealth(HealthCheckStatus.SERVING);
    }
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
  async getFile(call: GrpcRequest<GetFileRequest>, callback: GrpcCallback<FileResponse>) {
    if (!this._adminFileHandlers)
      return callback({
        code: status.INTERNAL,
        message: 'File handlers not initiated',
      });
    const request = createParsedRouterRequest(
      call.request,
      undefined,
      { scope: call.request.scope },
      undefined,
      undefined,
      undefined,
      { user: { _id: call.request.userId } },
    );
    let result;
    if (call.request.scope || call.request.userId) {
      result = await this._fileHandlers.getFile(request);
    } else {
      result = await this._adminFileHandlers.getFile(request);
    }
    const response = this.storageParamAdapter.getFileResponse(result);
    callback(null, response);
  }

  async getFileData(
    call: GrpcRequest<GetFileRequest>,
    callback: GrpcCallback<GetFileDataResponse>,
  ) {
    if (!this._adminFileHandlers)
      return callback({
        code: status.INTERNAL,
        message: 'File handlers not initiated',
      });
    const request = createParsedRouterRequest(
      call.request,
      undefined,
      { scope: call.request.scope },
      undefined,
      undefined,
      undefined,
      { user: { _id: call.request.userId } },
    );
    let result;
    if (call.request.scope || call.request.userId) {
      result = await this._fileHandlers.getFileData(request);
    } else {
      result = await this._adminFileHandlers.getFileData(request);
    }
    callback(null, result as GetFileDataResponse);
  }

  async getFileUrl(
    call: GrpcRequest<GetFileUrlRequest>,
    callback: GrpcCallback<GetFileUrlResponse>,
  ) {
    if (!this._adminFileHandlers)
      return callback({
        code: status.INTERNAL,
        message: 'File handlers not initiated',
      });
    const request = createParsedRouterRequest(
      call.request,
      undefined,
      { scope: call.request.scope },
      undefined,
      undefined,
      undefined,
      { user: { _id: call.request.userId } },
    );
    let result;
    if (call.request.scope || call.request.userId) {
      result = await this._fileHandlers.getFileUrl(request);
    } else {
      result = await this._adminFileHandlers.getFileUrl(request);
    }
    callback(null, { url: (result as Indexable).result as string });
  }

  async createFile(
    call: GrpcRequest<CreateFileRequest>,
    callback: GrpcCallback<FileResponse>,
  ) {
    if (!this._adminFileHandlers)
      return callback({
        code: status.INTERNAL,
        message: 'File handlers not initiated',
      });
    const request = createParsedRouterRequest(
      call.request,
      undefined,
      { scope: call.request.scope },
      undefined,
      undefined,
      undefined,
      { user: { _id: call.request.userId } },
    );
    let result;
    if (call.request.scope || call.request.userId) {
      result = await this._fileHandlers.createFile(request);
    } else {
      result = await this._adminFileHandlers.createFile(request);
    }
    const response = this.storageParamAdapter.getFileResponse(result);
    callback(null, response);
  }

  async updateFile(
    call: GrpcRequest<UpdateFileRequest>,
    callback: GrpcCallback<FileResponse>,
  ) {
    if (!this._adminFileHandlers)
      return callback({
        code: status.INTERNAL,
        message: 'File handlers not initiated',
      });
    const request = createParsedRouterRequest(
      call.request,
      undefined,
      { scope: call.request.scope },
      undefined,
      undefined,
      undefined,
      { user: { _id: call.request.userId } },
    );
    let result;
    if (call.request.scope || call.request.userId) {
      result = await this._fileHandlers.updateFile(request);
    } else {
      result = await this._adminFileHandlers.updateFile(request);
    }
    const response = this.storageParamAdapter.getFileResponse(result);
    callback(null, response);
  }

  async deleteFile(
    call: GrpcRequest<GetFileRequest>,
    callback: GrpcResponse<DeleteFileResponse>,
  ) {
    if (!this._adminFileHandlers)
      return callback({
        code: status.INTERNAL,
        message: 'File handlers not initiated',
      });
    const request = createParsedRouterRequest(
      call.request,
      undefined,
      { scope: call.request.scope },
      undefined,
      undefined,
      undefined,
      { user: { _id: call.request.userId } },
    );
    let result;
    if (call.request.scope || call.request.userId) {
      result = await this._fileHandlers.deleteFile(request);
    } else {
      result = await this._adminFileHandlers.deleteFile(request);
    }
    callback(null, result as DeleteFileResponse);
  }

  async createFileByUrl(
    call: GrpcRequest<CreateFileByUrlRequest>,
    callback: GrpcResponse<FileByUrlResponse>,
  ) {
    if (!this._adminFileHandlers)
      return callback({
        code: status.INTERNAL,
        message: 'File handlers not initiated',
      });
    const request = createParsedRouterRequest(
      call.request,
      undefined,
      { scope: call.request.scope },
      undefined,
      undefined,
      undefined,
      { user: { _id: call.request.userId } },
    );
    let result;
    if (call.request.scope || call.request.userId) {
      result = await this._fileHandlers.createFileUploadUrl(request);
    } else {
      result = await this._adminFileHandlers.createFileUploadUrl(request);
    }
    const response = this.storageParamAdapter.getFileByUrlResponse(result);
    callback(null, response);
  }

  async updateFileByUrl(
    call: GrpcRequest<UpdateFileByUrlRequest>,
    callback: GrpcResponse<FileByUrlResponse>,
  ) {
    if (!this._adminFileHandlers)
      return callback({
        code: status.INTERNAL,
        message: 'File handlers not initiated',
      });
    const request = createParsedRouterRequest(
      call.request,
      undefined,
      { scope: call.request.scope },
      undefined,
      undefined,
      undefined,
      { user: { _id: call.request.userId } },
    );
    let result;
    if (call.request.scope || call.request.userId) {
      result = await this._fileHandlers.updateFileUploadUrl(request);
    } else {
      result = await this._adminFileHandlers.updateFileUploadUrl(request);
    }
    const response = this.storageParamAdapter.getFileByUrlResponse(result);
    callback(null, response);
  }

  protected registerSchemas(): Promise<unknown> {
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
}
