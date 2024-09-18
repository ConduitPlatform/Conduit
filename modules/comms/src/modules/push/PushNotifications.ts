import {
  ConduitGrpcSdk,
  DatabaseProvider,
  GrpcRequest,
  GrpcResponse,
  HealthCheckStatus,
} from '@conduitplatform/grpc-sdk';
import { AdminHandlers } from './admin/index.js';
import { PushNotificationsRoutes } from './routes/index.js';
import * as models from './models/index.js';
import { FirebaseProvider } from './providers/Firebase.provider.js';
import { BaseNotificationProvider } from './providers/base.provider.js';
import { isNil } from 'lodash-es';
import { status } from '@grpc/grpc-js';
import { ISendNotification } from './interfaces/ISendNotification.js';
import { runMigrations } from './migrations/index.js';
import { OneSignalProvider } from './providers/OneSignal.provider.js';
import { ConfigController, RoutingManager } from '@conduitplatform/module-tools';
import {
  GetNotificationTokensRequest,
  GetNotificationTokensResponse,
  SendManyNotificationsRequest,
  SendNotificationRequest,
  SendNotificationResponse,
  SendNotificationToManyDevicesRequest,
  SetNotificationTokenRequest,
  SetNotificationTokenResponse,
} from '../../protoTypes/comms.js';
import { CommService } from '../../interfaces/CommService.js';

export default class PushNotifications implements CommService {
  readonly functions = {
    setNotificationToken: this.setNotificationToken.bind(this),
    getNotificationTokens: this.getNotificationTokens.bind(this),
    sendNotification: this.sendNotification.bind(this),
    sendNotificationToManyDevices: this.sendToManyDevices.bind(this),
    sendManyNotifications: this.sendMany.bind(this),
  };

  private isRunning = false;
  private canServe = false;
  private authServing = false;
  private adminRouter!: AdminHandlers;
  private userRouter!: PushNotificationsRoutes;
  private database!: DatabaseProvider;
  private _provider: BaseNotificationProvider<unknown> | undefined;

  private static _instance: PushNotifications;
  private _health: HealthCheckStatus = HealthCheckStatus.UNKNOWN;

  private constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  static getInstance(grpcSdk?: ConduitGrpcSdk) {
    if (!PushNotifications._instance) {
      if (!grpcSdk) throw new Error('GrpcSdk must be provided');
      PushNotifications._instance = new PushNotifications(grpcSdk);
    }
    return PushNotifications._instance;
  }

  get rpcFunctions() {
    return this.functions;
  }

  get health() {
    return this._health;
  }

  registerAdminRoutes(routingManager: RoutingManager) {
    this.adminRouter.registerAdminRoutes(routingManager);
  }

  registerRoutes(routingManager: RoutingManager) {
    this.userRouter.registerRoutes(routingManager);
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
    try {
      await this.enableModule();
      this.canServe = true;
      this.updateHealthState(HealthCheckStatus.SERVING);
    } catch (e) {
      this.canServe = false;
      this.updateHealthState(HealthCheckStatus.NOT_SERVING);
    }
  }

  // gRPC Service
  async setNotificationToken(
    call: GrpcRequest<SetNotificationTokenRequest>,
    callback: GrpcResponse<SetNotificationTokenResponse>,
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
    call: GrpcRequest<GetNotificationTokensRequest>,
    callback: GrpcResponse<GetNotificationTokensResponse>,
  ) {
    const userId = call.request.userId;
    let errorMessage: string | null = null;
    const tokenDocuments = await models.NotificationToken.getInstance()
      .findMany({ userId })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (errorMessage) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }
    const tokenDocs: string[] = [];
    for (const tokenDocument of tokenDocuments || []) {
      const tokenDocumentString = JSON.stringify(tokenDocument);
      tokenDocs.push(tokenDocumentString);
    }
    return callback(null, { tokenDocuments: tokenDocs });
  }

  async sendNotification(
    call: GrpcRequest<SendNotificationRequest>,
    callback: GrpcResponse<SendNotificationResponse>,
  ) {
    try {
      await this._provider!.sendToDevice({
        ...call.request,
        data: call.request.data ? JSON.parse(call.request.data) : {},
      });
    } catch (e) {
      return callback({ code: status.INTERNAL, message: (e as Error).message });
    }
    return callback(null, { message: 'Ok' });
  }

  async sendToManyDevices(
    call: GrpcRequest<SendNotificationToManyDevicesRequest>,
    callback: GrpcResponse<SendNotificationResponse>,
  ) {
    try {
      await this._provider!.sendToManyDevices({
        ...call.request,
        data: call.request.data ? JSON.parse(call.request.data) : {},
      });
    } catch (e) {
      return callback({ code: status.INTERNAL, message: (e as Error).message });
    }
    return callback(null, { message: 'Ok' });
  }

  async sendMany(
    call: GrpcRequest<SendManyNotificationsRequest>,
    callback: GrpcResponse<SendNotificationResponse>,
  ) {
    let params: ISendNotification[];
    try {
      params = call.request.notifications.map(notification => ({
        ...notification,
        data: notification.data ? JSON.parse(notification.data) : {},
      }));
      await this._provider!.sendMany(params);
    } catch (e) {
      return callback({ code: status.INTERNAL, message: (e as Error).message });
    }
    return callback(null, { message: 'Ok' });
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

  private updateHealthState(stateUpdate?: HealthCheckStatus, authServing?: boolean) {
    if (authServing !== undefined) {
      this.authServing = authServing;
    }
    const moduleActive = ConfigController.getInstance().config.active;
    const depState =
      moduleActive && this.authServing
        ? HealthCheckStatus.SERVING
        : HealthCheckStatus.NOT_SERVING;
    const requestedState =
      stateUpdate ?? this.canServe
        ? HealthCheckStatus.SERVING
        : HealthCheckStatus.NOT_SERVING;
    const nextState =
      depState === requestedState && requestedState === HealthCheckStatus.SERVING
        ? HealthCheckStatus.SERVING
        : HealthCheckStatus.NOT_SERVING;
    this._health = nextState;
  }

  private async enableModule() {
    if (!this.isRunning) {
      await this.initProvider();
      if (!this._provider || !this._provider?.isInitialized) {
        throw new Error('Provider failed to initialize');
      }
      this.userRouter = new PushNotificationsRoutes(this.grpcSdk);
      this.adminRouter = new AdminHandlers(this.grpcSdk, this._provider!);
      this.isRunning = true;
    } else {
      await this.initProvider();
      if (!this._provider || !this._provider?.isInitialized) {
        throw new Error('Provider failed to initialize');
      }
      this.adminRouter.updateProvider(this._provider!);
    }
  }

  private async initProvider() {
    const notificationsConfig = await this.grpcSdk.config.get('pushNotifications');
    const name = notificationsConfig.providerName;
    const settings = notificationsConfig[name];
    if (name === 'firebase') {
      this._provider = new FirebaseProvider(settings);
    } else if (name === 'onesignal') {
      this._provider = new OneSignalProvider(settings);
    } else if (name === 'basic') {
      this._provider = new BaseNotificationProvider();
    } else {
      throw new Error('Provider not supported');
    }
  }
}
