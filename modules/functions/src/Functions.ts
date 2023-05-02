import ConduitGrpcSdk, {
  DatabaseProvider,
  HealthCheckStatus,
} from '@conduitplatform/grpc-sdk';
import metricsSchema from './metrics';
import { AdminHandlers } from './admin';
import * as models from './models';
import AppConfigSchema, { Config } from './config';
import { FunctionController } from './controllers/function.controller';
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
    this.grpcSdk
      .waitForExistence('router')
      .then(() => {
        this.isRunning = true;
        this.functionsController = new FunctionController(this.grpcServer, this.grpcSdk);
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

  async onConfig() {
    if (!ConfigController.getInstance().config.active) {
      this.updateHealth(HealthCheckStatus.NOT_SERVING);
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
