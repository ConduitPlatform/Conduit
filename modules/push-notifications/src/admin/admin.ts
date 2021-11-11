import { isEmpty, isNil } from 'lodash';
import ConduitGrpcSdk, {
  GrpcServer,
  RouterRequest,
  RouterResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import { IPushNotificationsProvider } from '../interfaces/IPushNotificationsProvider';
import { NotificationToken } from '../models'

let paths = require('./admin.json').functions;

export class AdminHandlers {
  private provider: IPushNotificationsProvider;
  private readonly conduit: ConduitGrpcSdk;

  constructor(
    server: GrpcServer,
    conduit: ConduitGrpcSdk,
    provider: IPushNotificationsProvider
  ) {
    this.conduit = conduit;
    this.provider = provider;

    this.conduit.admin
      .registerAdmin(server, paths, {
        sendNotification: this.sendNotification.bind(this),
        sendManyNotifications: this.sendManyNotifications.bind(this),
        sendToManyDevices: this.sendToManyDevices.bind(this),
        getNotificationToken: this.getNotificationToken.bind(this),
      })
      .catch((err: Error) => {
        console.log('Failed to register admin routes for module!');
        console.error(err);
      });
  }

  updateProvider(provider: IPushNotificationsProvider) {
    this.provider = provider;
  }

  async sendNotification(call: RouterRequest, callback: RouterResponse) {
    const { title, body, data, userId } = JSON.parse(call.request.params);
    if (isNil(title) || isNil(userId))
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Required fields are missing',
      });
    const params = {
      title,
      body,
      data,
      sendTo: userId,
    };
    if (isNil(params))
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Required fields are missing',
      });

    let errorMessage = null;
    await this.provider
      .sendToDevice(params)
      .catch((e) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    return callback(null, { result: JSON.stringify({ message: 'Ok' }) });
  }

  async sendManyNotifications(call: RouterRequest, callback: RouterResponse) {
    let requestParams = JSON.parse(call.request.params);
    const params = requestParams.map((param: any) => {
      if (isNil(param.title) || isNil(param.userId))
        return callback({
          code: status.INVALID_ARGUMENT,
          message: 'Required fields are missing',
        });

      return {
        sendTo: param.userId,
        title: param.title,
        body: param.body,
        data: param.data,
      };
    });
    if (isNil(params))
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Required fields are missing',
      });

    let errorMessage = null;
    await this.provider
      .sendMany(params)
      .catch((e) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    return callback(null, { result: JSON.stringify({ message: 'Ok' }) });
  }

  async sendToManyDevices(call: RouterRequest, callback: RouterResponse) {
    const { userIds, title, body, data } = JSON.parse(call.request.params);

    if (isNil(title) || isNil(userIds) || isEmpty(userIds))
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Required fields are missing',
      });

    const params = {
      sendTo: userIds,
      title,
      body,
      data,
    };
    if (isNil(params))
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Required fields are missing',
      });

    let errorMessage = null;
    await this.provider
      .sendToManyDevices(params)
      .catch((e) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    return callback(null, { result: JSON.stringify({ message: 'Ok' }) });
  }

  async getNotificationToken(call: RouterRequest, callback: RouterResponse) {
    const { userId } = JSON.parse(call.request.params);
    if (isNil(userId)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'User id parameter was not provided',
      });
    }

    let errorMessage = null;
    const tokenDocuments = await NotificationToken.getInstance()
      .findMany({ userId })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    return callback(null, { result: JSON.stringify({ tokenDocuments }) });
  }
}
