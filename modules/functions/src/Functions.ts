import ConduitGrpcSdk, {
  DatabaseProvider,
  HealthCheckStatus,
} from '@conduitplatform/grpc-sdk';
import metricsSchema from './metrics/index.js';
import { AdminHandlers } from './admin/index.js';
import * as models from './models/index.js';
import AppConfigSchema, { Config } from './config/index.js';
import { FunctionController } from './controllers/function.controller.js';
import { ConfigController, ManagedModule } from '@conduitplatform/module-tools';

export default class Functions extends ManagedModule<Config> {
  configSchema = AppConfigSchema;
  protected metricsSchema = metricsSchema;
  private isRunning: boolean = false;
  private adminRouter: AdminHandlers;

  private functionsController: FunctionController;
  private database: DatabaseProvider;

  constructor() {
    super('functions');
    this.updateHealth(HealthCheckStatus.UNKNOWN, true);
  }

  async onServerStart() {
    await this.grpcSdk.waitForExistence('database');
    this.database = this.grpcSdk.database!;
    await this.registerSchemas();
  }

  async onConfig() {
    if (!ConfigController.getInstance().config.active) {
      this.updateHealth(HealthCheckStatus.NOT_SERVING);
    }
    if (!this.isRunning) {
      this.grpcSdk
        .waitForExistence('router')
        .then(() => {
          this.isRunning = true;
          this.functionsController = new FunctionController(
            this.grpcServer,
            this.grpcSdk,
          );
          this.adminRouter = new AdminHandlers(
            this.grpcServer,
            this.grpcSdk,
            this.functionsController,
          );
          return this.functionsController.refreshRoutes();
        })
        .catch(e => {
          ConduitGrpcSdk.Logger.error(e.message);
        });
    }
    this.updateHealth(HealthCheckStatus.SERVING);
  }

  protected registerSchemas() {
    const promises = Object.values(models).map(model => {
      const modelInstance = model.getInstance(this.database);
      return this.database
        .createSchemaFromAdapter(modelInstance)
        .then(() => this.database.migrate(modelInstance.name));
    });
    return Promise.all(promises);
  }
}
