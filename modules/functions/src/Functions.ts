import ConduitGrpcSdk, {
  ConfigController,
  DatabaseProvider,
  HealthCheckStatus,
  ManagedModule,
} from '@conduitplatform/grpc-sdk';
import metricsSchema from './metrics';
import path from 'path';
import { AdminHandlers } from './admin';
import { runMigrations } from './migrations';
import * as models from './models';
import AppConfigSchema, { Config } from './config';
import { FunctionController } from './controllers/function.controller';

export default class Functions extends ManagedModule<Config> {
  configSchema = AppConfigSchema;
  protected metricsSchema = metricsSchema;

  service = {
    protoPath: path.resolve(__dirname, 'functions.proto'),
    protoDescription: 'functions.Functions',
    functions: {
      setConfig: this.setConfig.bind(this),
    },
  };
  private isRunning: boolean = false;
  private adminRouter: AdminHandlers;
  private database: DatabaseProvider;

  constructor() {
    super('functions');
    this.updateHealth(HealthCheckStatus.UNKNOWN, true);
  }

  async onServerStart() {
    await this.grpcSdk.waitForExistence('database');
    this.database = this.grpcSdk.database!;
    await this.registerSchemas();
    await runMigrations(this.grpcSdk);
  }

  protected registerSchemas() {
    const promises = Object.values(models).map(model => {
      const modelInstance = model.getInstance(this.database);
      return this.database.createSchemaFromAdapter(modelInstance);
    });
    return Promise.all(promises);
  }

  async onConfig() {
    if (!ConfigController.getInstance().config.active) {
      this.updateHealth(HealthCheckStatus.NOT_SERVING);
    }
    this.adminRouter = new AdminHandlers(this.grpcServer, this.grpcSdk);
    this.isRunning = true;
    this.updateHealth(HealthCheckStatus.SERVING);
    const functionController = new FunctionController(this.grpcServer, this.grpcSdk);
    this.grpcSdk
      .waitForExistence('router')
      .then(() => {
        functionController.refreshRoutes();
      })
      .catch(e => {
        ConduitGrpcSdk.Logger.error(e.message);
      });
  }
}
