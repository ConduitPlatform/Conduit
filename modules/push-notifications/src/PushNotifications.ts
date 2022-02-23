import { IPushNotificationsProvider } from './interfaces/IPushNotificationsProvider';
import { IFirebaseSettings } from './interfaces/IFirebaseSettings';
import { FirebaseProvider } from './providers/Firebase.provider';
import PushNotificationsConfigSchema from './config';
import { isNil } from 'lodash';
import path from 'path';
import ConduitGrpcSdk, {
  ConduitServiceModule,
  GrpcServer,
  SetConfigRequest,
  SetConfigResponse,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { AdminHandlers } from './admin/admin';
import { PushNotificationsRoutes } from './routes/routes';
import * as models from './models';
import {
  GetNotificationTokensRequest,
  GetNotificationTokensResponse,
  SetNotificationTokenRequest,
  SetNotificationTokenResponse,
} from './types';

export default class PushNotificationsModule extends ConduitServiceModule {
  private database: any;
  private _provider: IPushNotificationsProvider | undefined;
  private isRunning: boolean = false;
  private adminHandlers?: AdminHandlers;

  private _routes!: any[];

  get routes() {
    return this._routes;
  }

  constructor(grpcSdk: ConduitGrpcSdk) {
    super();
    this.grpcSdk = grpcSdk;
  }

  async initialize(servicePort?: string) {
    this.grpcServer = new GrpcServer(servicePort);
    this._port = (await this.grpcServer.createNewServer()).toString();
    await this.grpcServer.addService(
      path.resolve(__dirname, './push-notifications.proto'),
      'pushnotifications.PushNotifications',
      {
        setConfig: this.setConfig.bind(this),
        setNotificationToken: this.setNotificationToken.bind(this),
        getNotificationTokens: this.getNotificationTokens.bind(this),
      }
    );
    this.grpcServer.start();
    console.log('Grpc server is online');
  }

  async activate() {
    await this.grpcSdk.waitForExistence('database');
    try {
      await this.grpcSdk.config.get('pushNotifications');
    } catch (e) {
      await this.grpcSdk.config.updateConfig(
        PushNotificationsConfigSchema.getProperties(),
        'pushNotifications'
      );
    }
    let notificationsConfig = await this.grpcSdk.config.addFieldstoConfig(
      PushNotificationsConfigSchema.getProperties(),
      'pushNotifications'
    );
    if (notificationsConfig.active) await this.enableModule();
  }

  async setConfig(call: SetConfigRequest, callback: SetConfigResponse) {
    const newConfig = JSON.parse(call.request.newConfig);
    try {
      PushNotificationsConfigSchema.load(newConfig).validate();
    } catch (e) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Invalid configuration values',
      });
    }
    let errorMessage: string | null = null;
    const updateResult = await this.grpcSdk.config
      .updateConfig(newConfig, 'pushNotifications')
      .catch((e: Error) => { errorMessage = e.message });
    if (errorMessage) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }
    const notificationsConfig = await this.grpcSdk.config.get('pushNotifications');
    if (notificationsConfig.active) {
      await this.enableModule().catch((e: Error) => { errorMessage = e.message });
    } else {
      return callback({
        code: status.FAILED_PRECONDITION,
        message: 'Module is not active',
      });
    }
    if (errorMessage) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }
    return callback(null, { updatedConfig: JSON.stringify(updateResult) });
  }

  async setNotificationToken(
    call: SetNotificationTokenRequest,
    callback: SetNotificationTokenResponse
  ) {
    const { token, platform, userId } = call.request;
    let errorMessage: string | null = null;
    models.NotificationToken.getInstance()
      .findOne({ userId, platform })
      .then((oldToken) => {
        if (!isNil(oldToken))
          return models.NotificationToken.getInstance().deleteOne(oldToken);
      })
      .catch((e: Error) => { errorMessage = e.message });
    if (errorMessage) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }
    const newTokenDocument = await models.NotificationToken.getInstance()
      .create({
        userId,
        token,
        platform,
      })
      .catch((e: Error) => { errorMessage = e.message });
    if (errorMessage) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }
    return callback(null, { newTokenDocument: JSON.stringify(newTokenDocument) });
  }

  async getNotificationTokens(
    call: GetNotificationTokensRequest,
    callback: GetNotificationTokensResponse
  ) {
    const userId = call.request.userId;
    let errorMessage: string | null = null;
    const tokenDocuments: any = await models.NotificationToken.getInstance()
      .findMany({ userId })
      .catch((e: Error) => { errorMessage = e.message });
    if (errorMessage) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }
    return callback(null, { tokenDocuments });
  }

  private async enableModule() {
    if (!this.isRunning) {
      this.database = this.grpcSdk.databaseProvider;
      await this.initProvider();
      await this.registerSchemas();
      let router = new PushNotificationsRoutes(this.grpcServer, this.grpcSdk);
      this._routes = router.registeredRoutes;
      this.adminHandlers = new AdminHandlers(
        this.grpcServer,
        this.grpcSdk,
        this._provider!
      );
      this.isRunning = true;
    } else {
      await this.initProvider();
      this.adminHandlers!.updateProvider(this._provider!);
    }
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

  private registerSchemas() {
    const promises = Object.values(models).map((model: any) => {
      let modelInstance = model.getInstance(this.database);
      if (Object.keys(modelInstance.fields).length !== 0) { // borrowed foreign model
        return this.database.createSchemaFromAdapter(modelInstance);
      }
    });
    return Promise.all(promises);
  }
}
