import {
  ConduitGrpcSdk,
  DatabaseProvider,
  HealthCheckStatus,
} from '@conduitplatform/grpc-sdk';
import AppConfigSchema, { Config } from './config/index.js';
import { FormSubmissionTemplate } from './templates/index.js';
import { AdminHandlers } from './admin/index.js';
import { FormsRoutes } from './routes/index.js';
import { FormsController } from './controllers/forms.controller.js';
import * as models from './models/index.js';
import { runMigrations } from './migrations/index.js';
import metricsSchema from './metrics/index.js';
import { ConfigController, ManagedModule } from '@conduitplatform/module-tools';

export default class Forms extends ManagedModule<Config> {
  configSchema = AppConfigSchema;
  protected metricsSchema = metricsSchema;
  private isRunning = false;
  private adminRouter: AdminHandlers;
  private userRouter: FormsRoutes;
  private database: DatabaseProvider;
  private formController: FormsController;

  constructor() {
    super('forms');
    this.updateHealth(HealthCheckStatus.UNKNOWN, true);
  }

  async onServerStart() {
    await this.grpcSdk.waitForExistence('database');
    this.database = this.grpcSdk.database!;
    await runMigrations(this.grpcSdk);
    await this.registerSchemas();
    this.grpcSdk.monitorModule('email', serving => {
      if (serving && ConfigController.getInstance().config.active) {
        this.onConfig()
          .then()
          .catch(() => {
            ConduitGrpcSdk.Logger.error('Failed to update Forms configuration');
          });
      } else {
        this.updateHealth(HealthCheckStatus.NOT_SERVING);
      }
    });
  }

  async onConfig() {
    if (!ConfigController.getInstance().config.active) {
      this.updateHealth(HealthCheckStatus.NOT_SERVING);
    } else {
      if (!this.isRunning) {
        if (!this.grpcSdk.isAvailable('email')) return;
        await this.grpcSdk.emailProvider!.registerTemplate(FormSubmissionTemplate);
        this.formController = new FormsController(this.grpcSdk);
        this.adminRouter = new AdminHandlers(
          this.grpcServer,
          this.grpcSdk,
          this.formController,
        );
        this.grpcSdk
          .waitForExistence('router')
          .then(() => {
            this.userRouter = new FormsRoutes(this.grpcServer, this.grpcSdk);
            this.formController.setRouter(this.userRouter);
            this.isRunning = true;
          })
          .catch(e => {
            ConduitGrpcSdk.Logger.error(e.message);
          });
      }
      this.updateHealth(HealthCheckStatus.SERVING);
    }
  }

  async initializeMetrics() {
    const formsTotal = await models.Forms.getInstance().countDocuments({});
    ConduitGrpcSdk.Metrics?.set('forms_total', formsTotal);
  }

  protected registerSchemas(): Promise<unknown> {
    const promises = Object.values(models).map(model => {
      const modelInstance = model.getInstance(this.database);
      return this.database
        .createSchemaFromAdapter(modelInstance)
        .then(() => this.database.migrate(modelInstance.name));
    });
    return Promise.all(promises);
  }
}
