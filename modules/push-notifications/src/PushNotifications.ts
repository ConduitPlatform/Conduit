import {
  ConfigController,
  DatabaseProvider,
  HealthCheckStatus,
  ManagedModule,
} from '@conduitplatform/grpc-sdk';
import AppConfigSchema, { Config } from './config';
import { AdminHandlers } from './admin';
import { PushNotificationsRoutes } from './routes';
import * as models from './models';
import {
  GetNotificationTokensRequest,
  GetNotificationTokensResponse,
  SendManyNotificationsRequest,
  SendNotificationRequest,
  SendNotificationResponse,
  SendToManyDevicesNotificationRequest,
  SetNotificationTokenRequest,
  SetNotificationTokenResponse,
} from './types';
import { FirebaseProvider } from './providers/Firebase.provider';
import { IFirebaseSettings } from './interfaces/IFirebaseSettings';
import { BaseNotificationProvider } from './providers/base.provider';
import path from 'path';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import {
  ISendNotification,
  ISendNotificationToManyDevices,
} from './interfaces/ISendNotification';
import { runMigrations } from './migrations';
import metricsSchema from './metrics';
import { OneSignalProvider } from './providers/OneSignal.provider';
import { IOneSignalSettings } from './interfaces/IOneSignalSettings';

export default class PushNotifications extends ManagedModule<Config> {
  configSchema = AppConfigSchema;
  protected metricsSchema = metricsSchema;
  service = {
    protoPath: path.resolve(__dirname, 'push-notifications.proto'),
    protoDescription: 'pushnotifications.PushNotifications',
    functions: {
      setConfig: this.setConfig.bind(this),
      setNotificationToken: this.setNotificationToken.bind(this),
      getNotificationTokens: this.getNotificationTokens.bind(this),
      sendNotification: this.sendNotification.bind(this),
      sendNotificationToManyDevices: this.sendToManyDevices.bind(this),
      sendManyNotifications: this.sendMany.bind(this),
    },
  };
  private isRunning = false;
  private authServing = false;
  private adminRouter!: AdminHandlers;
  private userRouter!: PushNotificationsRoutes;
  private database!: DatabaseProvider;
  private _provider: BaseNotificationProvider | undefined;

  constructor() {
    super('pushNotifications');
    this.updateHealth(HealthCheckStatus.UNKNOWN, true);
  }

  async onServerStart() {
    await this.grpcSdk.waitForExistence('database');
    this.database = this.grpcSdk.database!;
    await this.registerSchemas();
    await runMigrations(this.grpcSdk);
    await this.grpcSdk.monitorModule('authentication', serving => {
      this.updateHealthState(undefined, serving);
    });
  }

  async onConfig() {
    if (!ConfigController.getInstance().config.active) {
      this.updateHealthState(HealthCheckStatus.NOT_SERVING);
    } else {
      try {
        await this.enableModule();
        this.updateHealthState(HealthCheckStatus.SERVING);
      } catch (e) {
        this.updateHealthState(HealthCheckStatus.NOT_SERVING);
      }
    }
  }

  private updateHealthState(stateUpdate?: HealthCheckStatus, authServing?: boolean) {
    if (authServing) {
      this.authServing = authServing;
    }
    const moduleActive = ConfigController.getInstance().config.active;
    const depState =
      moduleActive && this.authServing
        ? HealthCheckStatus.SERVING
        : HealthCheckStatus.NOT_SERVING;
    const requestedState = stateUpdate ?? this.healthState;
    const nextState =
      depState === requestedState && requestedState === HealthCheckStatus.SERVING
        ? HealthCheckStatus.SERVING
        : HealthCheckStatus.NOT_SERVING;
    this.updateHealth(nextState);
  }

  private async enableModule() {
    if (!this.isRunning) {
      await this.initProvider();
      if (!this._provider || !this._provider?.isInitialized) {
        throw new Error('Provider failed to initialize');
      }
      if (this.grpcSdk.isAvailable('router')) {
        this.userRouter = new PushNotificationsRoutes(this.grpcServer, this.grpcSdk);
      } else {
        this.grpcSdk.monitorModule('router', serving => {
          if (serving) {
            this.userRouter = new PushNotificationsRoutes(this.grpcServer, this.grpcSdk);
            this.grpcSdk.unmonitorModule('router');
          }
        });
      }

      this.adminRouter = new AdminHandlers(
        this.grpcServer,
        this.grpcSdk,
        this._provider!,
      );
      this.isRunning = true;
    } else {
      await this.initProvider();
      if (!this._provider || !this._provider?.isInitialized) {
        throw new Error('Provider failed to initialize');
      }
      this.adminRouter.updateProvider(this._provider!);
    }
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

  private async initProvider() {
    const notificationsConfig = await this.grpcSdk.config.get('pushNotifications');
    const name = notificationsConfig.providerName;
    const settings = notificationsConfig[name];
    if (name === 'firebase') {
      this._provider = new FirebaseProvider(settings as IFirebaseSettings);
    } else if (name === 'onesignal') {
      this._provider = new OneSignalProvider(settings as IOneSignalSettings);
    } else if (name === 'basic') {
      this._provider = new BaseNotificationProvider();
    } else {
      throw new Error('Provider not supported');
    }
  }

  async initializeMetrics() {}

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
    let errorMessage: string | null = null;
    try {
      const params: ISendNotification = this.parseParams(call, call.request.data);
      await this._provider!.sendToDevice(params).catch(e => {
        errorMessage = e;
      });
    } catch (e) {
      return callback({ code: status.INTERNAL, message: (e as Error).message });
    }
    if (errorMessage) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }
    return callback(null, { message: 'Ok' });
  }

  async sendToManyDevices(
    call: SendToManyDevicesNotificationRequest,
    callback: SendNotificationResponse,
  ) {
    let errorMessage: string | null = null;
    try {
      const params: ISendNotificationToManyDevices = this.parseParams(
        call,
        call.request.data,
      );
      await this._provider!.sendToManyDevices(params).catch(e => {
        errorMessage = e;
      });
    } catch (e) {
      return callback({ code: status.INTERNAL, message: (e as Error).message });
    }
    if (errorMessage) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }
    return callback(null, { message: 'Ok' });
  }

  async sendMany(call: SendManyNotificationsRequest, callback: SendNotificationResponse) {
    let params: ISendNotification[];
    try {
      params = call.request.notifications.map(notification => ({
        sendTo: notification.sendTo,
        title: notification.title,
        body: notification.body,
        data: notification.data ? JSON.parse(notification.data) : {},
        type: notification.type,
        platform: notification.platform,
        doNotStore: notification.doNotStore,
      }));
    } catch (e) {
      return callback({ code: status.INTERNAL, message: (e as Error).message });
    }
    let errorMessage: string | null = null;
    await this._provider!.sendMany(params).catch(e => {
      errorMessage = e;
    });
    if (errorMessage) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }
    return callback(null, { message: 'Ok' });
  }

  parseParams(call: any, data?: string) {
    try {
      return {
        sendTo: call.request.sendTo,
        title: call.request.title,
        body: call.request.body,
        data: data ? JSON.parse(data) : {},
        type: call.request.type,
        platform: call.request.platform,
        doNotStore: call.request.doNotStore,
      };
    } catch (e) {
      throw new Error((e as Error).message);
    }
  }
}
