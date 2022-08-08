import ConduitGrpcSdk, {
  ManagedModule,
  DatabaseProvider,
  ConfigController,
  HealthCheckStatus,
} from '@conduitplatform/grpc-sdk';
import AppConfigSchema, { Config } from './config';
import { AdminHandlers } from './admin';
import { PushNotificationsRoutes } from './routes';
import * as models from './models';
import {
  GetNotificationTokensRequest,
  GetNotificationTokensResponse,
  SendNotificationRequest,
  SendNotificationResponse,
  SetNotificationTokenRequest,
  SetNotificationTokenResponse,
} from './types';
import { FirebaseProvider } from './providers/Firebase.provider';
import { IFirebaseSettings } from './interfaces/IFirebaseSettings';
import { IPushNotificationsProvider } from './interfaces/IPushNotificationsProvider';
import path from 'path';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import { ISendNotification } from './interfaces/ISendNotification';
import { runMigrations } from './migrations';
import metricsConfig from './metrics';

export default class PushNotifications extends ManagedModule<Config> {
  configSchema = AppConfigSchema;
  service = {
    protoPath: path.resolve(__dirname, 'push-notifications.proto'),
    protoDescription: 'pushnotifications.PushNotifications',
    functions: {
      setConfig: this.setConfig.bind(this),
      setNotificationToken: this.setNotificationToken.bind(this),
      getNotificationTokens: this.getNotificationTokens.bind(this),
      sendNotification: this.sendNotification.bind(this),
    },
  };
  private isRunning: boolean = false;
  private adminRouter!: AdminHandlers;
  private userRouter!: PushNotificationsRoutes;
  private database!: DatabaseProvider;
  private _provider: IPushNotificationsProvider | undefined;

  constructor() {
    super('pushNotifications');
    this.updateHealth(HealthCheckStatus.UNKNOWN, true);
  }

  async onServerStart() {
    await this.grpcSdk.waitForExistence('database');
    this.database = this.grpcSdk.database!;
    await runMigrations(this.grpcSdk);
    await this.grpcSdk.monitorModule('authentication', serving => {
      if (serving && ConfigController.getInstance().config.active) {
        this.updateHealth(HealthCheckStatus.SERVING);
      } else {
        this.updateHealth(HealthCheckStatus.NOT_SERVING);
      }
    });
  }

  initializeMetrics() {
    for (const metric of Object.values(metricsConfig)) {
      this.grpcSdk.registerMetric(metric.type, metric.config);
    }
  }

  async onConfig() {
    if (!ConfigController.getInstance().config.active) {
      this.updateHealth(HealthCheckStatus.NOT_SERVING);
    } else {
      await this.enableModule();
      this.updateHealth(HealthCheckStatus.SERVING);
    }
  }

  private async enableModule() {
    if (!this.isRunning) {
      await this.initProvider();
      await this.registerSchemas();
      const self = this;
      this.grpcSdk
        .waitForExistence('router')
        .then(() => {
          self.userRouter = new PushNotificationsRoutes(self.grpcServer, self.grpcSdk);
        })
        .catch(e => {
          ConduitGrpcSdk.Logger.error(e.message);
        });

      this.adminRouter = new AdminHandlers(
        this.grpcServer,
        this.grpcSdk,
        this._provider!,
      );
      this.isRunning = true;
    } else {
      await this.initProvider();
      this.adminRouter.updateProvider(this._provider!);
    }
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

  private async initProvider() {
    const notificationsConfig = await this.grpcSdk.config.get('pushNotifications');
    const name = notificationsConfig.providerName;
    const settings = notificationsConfig[name];

    if (name === 'firebase') {
      this._provider = new FirebaseProvider(settings as IFirebaseSettings);
    } else {
      // this was done just for now so that we surely initialize the _provider variable
      this._provider = new FirebaseProvider(settings as IFirebaseSettings);
    }
  }

  // gRPC Service
  async setNotificationToken(
    call: SetNotificationTokenRequest,
    callback: SetNotificationTokenResponse,
  ) {
    const { token, platform, userId } = call.request;
    let errorMessage: string | null = null;
    models.NotificationToken.getInstance()
      .findOne({ userId, platform })
      .then(oldToken => {
        if (!isNil(oldToken))
          return models.NotificationToken.getInstance().deleteOne(oldToken);
      })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (errorMessage) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }
    const newTokenDocument = await models.NotificationToken.getInstance()
      .create({
        userId,
        token,
        platform,
      })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (errorMessage) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }
    return callback(null, { newTokenDocument: JSON.stringify(newTokenDocument) });
  }

  async getNotificationTokens(
    call: GetNotificationTokensRequest,
    callback: GetNotificationTokensResponse,
  ) {
    const userId = call.request.userId;
    let errorMessage: string | null = null;
    const tokenDocuments: any = await models.NotificationToken.getInstance()
      .findMany({ userId })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (errorMessage) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }
    return callback(null, { tokenDocuments });
  }

  async sendNotification(
    call: SendNotificationRequest,
    callback: SendNotificationResponse,
  ) {
    const data = call.request.data;
    let params: ISendNotification;
    try {
      params = {
        sendTo: call.request.sendTo,
        title: call.request.title,
        body: call.request.body,
        data: data ? JSON.parse(data) : {},
        type: call.request.type,
      };
    } catch (e) {
      return callback({ code: status.INTERNAL, message: (e as Error).message });
    }
    let errorMessage: string | null = null;
    await this._provider!.sendToDevice(params).catch(e => {
      errorMessage = e;
    });
    if (errorMessage) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }
    return callback(null, { message: 'Ok' });
  }
}
