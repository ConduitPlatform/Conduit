import ConduitGrpcSdk, {
  ManagedModule,
  ConfigController,
  DatabaseProvider,
  HealthCheckStatus,
} from '@conduitplatform/grpc-sdk';
import path from 'path';
import AppConfigSchema, { Config } from './config';
import * as models from './models';
import { AdminHandlers } from './admin';
import { runMigrations } from './migrations';
import metricsConfig from './metrics';

export default class Authorization extends ManagedModule<Config> {
  configSchema = AppConfigSchema;
  service = {
    protoPath: path.resolve(__dirname, 'authorization.proto'),
    protoDescription: 'authorization.Authorization',
    functions: {
      setConfig: this.setConfig.bind(this),
    },
  };
  private adminRouter: AdminHandlers;
  // private userRouter: AuthenticationRoutes;
  private database: DatabaseProvider;
  private localSendVerificationEmail: boolean = false;
  private refreshAppRoutesTimeout: NodeJS.Timeout | null = null;

  constructor() {
    super('authorization');
    this.updateHealth(HealthCheckStatus.UNKNOWN, true);
  }

  async onServerStart() {
    await this.grpcSdk.waitForExistence('database');
    this.database = this.grpcSdk.database!;
    await runMigrations(this.grpcSdk);
    await this.grpcSdk.monitorModule('authentication', serving => {
      this.updateHealth(
        serving ? HealthCheckStatus.SERVING : HealthCheckStatus.NOT_SERVING,
      );
    });
  }

  protected registerSchemas() {
    const promises = Object.values(models).map(model => {
      const modelInstance = model.getInstance(this.database);
      return this.database.createSchemaFromAdapter(modelInstance);
    });
    return Promise.all(promises);
  }

  async onConfig() {
    const config = ConfigController.getInstance().config;
    if (!config.active) {
      this.updateHealth(HealthCheckStatus.NOT_SERVING);
    } else {
      await this.registerSchemas();
      this.adminRouter = new AdminHandlers(this.grpcServer, this.grpcSdk);
      await this.refreshAppRoutes();
      this.updateHealth(HealthCheckStatus.SERVING);
    }
  }

  initializeMetrics() {
    for (const metric of Object.values(metricsConfig)) {
      this.grpcSdk.registerMetric(metric.type, metric.config);
    }
  }

  private async refreshAppRoutes() {
    // if (this.userRouter) {
    //   this.userRouter.updateLocalHandlers(this.localSendVerificationEmail);
    //   this.scheduleAppRouteRefresh();
    //   return;
    // }
    // const self = this;
    // this.grpcSdk
    //   .waitForExistence('router')
    //   .then(() => {
    //     self.userRouter = new AuthenticationRoutes(
    //       self.grpcServer,
    //       self.grpcSdk,
    //       self.localSendVerificationEmail,
    //     );
    //     this.scheduleAppRouteRefresh();
    //   })
    //   .catch(e => {
    //     ConduitGrpcSdk.Logger.error(e.message);
    //   });
  }

  private scheduleAppRouteRefresh() {
    // if (this.refreshAppRoutesTimeout) {
    //   clearTimeout(this.refreshAppRoutesTimeout);
    //   this.refreshAppRoutesTimeout = null;
    // }
    // this.refreshAppRoutesTimeout = setTimeout(async () => {
    //   try {
    //     await this.userRouter.registerRoutes();
    //   } catch (err) {
    //     ConduitGrpcSdk.Logger.error(err as Error);
    //   }
    //   this.refreshAppRoutesTimeout = null;
    // }, 800);
  }
}
