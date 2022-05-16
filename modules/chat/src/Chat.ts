import {
  ManagedModule,
  DatabaseProvider,
  ConfigController,
  HealthCheckStatus, GrpcRequest, GrpcResponse,
} from '@conduitplatform/grpc-sdk';

import AppConfigSchema, { Config } from './config';
import { AdminHandlers } from './admin/admin';
import { ChatRoutes } from './routes/routes';
import * as models from './models';
import { validateUsersInput } from './utils';
import { ChatMessage, ChatRoom } from './models';
import path from 'path';
import { isArray, isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import { CreateRoomRequest, RoomResponse, SendMessageRequest } from './type';

export default class Chat extends ManagedModule<Config> {
  config = AppConfigSchema;
  service = {
    protoPath: path.resolve(__dirname, 'chat.proto'),
    protoDescription: 'chat.Chat',
    functions: {
      setConfig: this.setConfig.bind(this),
      createRoom: this.createRoom.bind(this),
      deleteRoom: this.deleteRoom.bind(this),
      sendMessage: this.sendMessage.bind(this),
    },
  };
  private adminRouter: AdminHandlers;
  private userRouter: ChatRoutes;
  private database: DatabaseProvider;
  private _sendEmail: boolean;
  private _sendPushNotification: boolean;
  private _emailServing: boolean;
  private _pushNotificationsServing: boolean;

  private get sendEmail() {
    return this._sendEmail && this._emailServing;
  }

  private get sendPushNotification() {
    return this._sendPushNotification && this._pushNotificationsServing;
  }

  constructor() {
    super('chat');
    this.updateHealth(HealthCheckStatus.UNKNOWN, true);
  }

  async onServerStart() {
    this.database = this.grpcSdk.databaseProvider!;
    await this.grpcSdk.monitorModule('authentication', (serving) => {
      this.updateHealth(serving ? HealthCheckStatus.SERVING : HealthCheckStatus.NOT_SERVING);
    });
  }

  async onConfig() {
    const config = await ConfigController.getInstance().config;
    if (!config.active) {
      this.updateHealth(HealthCheckStatus.NOT_SERVING);
    } else {
      await this.registerSchemas();
      this._sendEmail = config.explicit_room_joins.enabled && config.explicit_room_joins.send_email;
      if (this._sendEmail) {
        await this.grpcSdk.monitorModule('email', (serving) => {
          this._emailServing = serving;
          this.refreshAppRoutes(); // redundant while called directly by onConfig() with sendPushNotification === true
        });
      } else {
        this.grpcSdk.unmonitorModule('email');
      }
      this._sendPushNotification = config.explicit_room_joins.enabled && config.explicit_room_joins.send_notification;
      if (this._sendPushNotification) {
        await this.grpcSdk.monitorModule('pushNotifications', (serving) => {
          this._pushNotificationsServing = serving;
          this.refreshAppRoutes();
        });
      } else {
        this.grpcSdk.unmonitorModule('pushNotifications');
      }
      this.adminRouter = new AdminHandlers(this.grpcServer, this.grpcSdk);
      if (!this._sendEmail && !this._sendPushNotification) { // avoid redundant refreshes
        await this.refreshAppRoutes();
      }
      this.updateHealth(HealthCheckStatus.SERVING);
    }
  }

  private async refreshAppRoutes() {
    this.userRouter = new ChatRoutes(
      this.grpcServer,
      this.grpcSdk,
      this.sendEmail,
      this.sendPushNotification,
    );
    await this.userRouter.registerRoutes();
  }

  protected registerSchemas() {
    const promises = Object.values(models).map((model: any) => {
      const modelInstance = model.getInstance(this.database);
      if (Object.keys(modelInstance.fields).length !== 0) { // borrowed foreign model
        return this.database.createSchemaFromAdapter(modelInstance);
      }
    });
    return Promise.all(promises);
  }

  // gRPC Service
  async createRoom(call: CreateRoomRequest, callback: RoomResponse) {
    const { name, participants } = call.request;

    if (isNil(participants) || !isArray(participants) || participants.length === 0) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'participants array is required and cannot be empty',
      });
    }

    try {
      await validateUsersInput(this.grpcSdk, participants);
    } catch (e) {
      return callback({ code: e.code, message: e.message });
    }

    let errorMessage: string | null = null;
    const room = await models.ChatRoom.getInstance()
      .create({
        name: name,
        participants: participants,
      })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    this.grpcSdk.bus?.publish(
      'chat:create:ChatRoom',
      JSON.stringify({
        name: (room as models.ChatRoom).name,
        participants: (room as models.ChatRoom).participants,
      }),
    );
    callback(null, {
      result: JSON.stringify({
        _id: (room as models.ChatRoom)._id,
        name: (room as models.ChatRoom).name,
        participants: (room as models.ChatRoom).participants,
      }),
    });
  }

  async sendMessage(call: SendMessageRequest, callback: GrpcResponse<null>) {
    const userId = call.request.userId;
    const { roomId, message } = call.request;

    let errorMessage: string | null = null;
    const room = await ChatRoom.getInstance()
      .findOne({ _id: roomId })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    // @ts-ignore
    if (isNil(room) || !(room as ChatRoom).participants.includes(userId)) {
      return callback({ code: status.INVALID_ARGUMENT, message: 'invalid room' });
    }

    ChatMessage.getInstance()
      .create({
        message,
        senderUser: userId,
        room: roomId,
        readBy: [userId],
      })
      .then(() => {
        return this.grpcSdk.router.socketPush({
          event: 'message',
          receivers: [roomId],
          rooms: [],
          data: JSON.stringify({ sender: userId, message, room: roomId }),
        });
      })
      .then(() => {
        callback(null, null);
      })
      .catch((e: Error) => {
        callback({
          code: status.INTERNAL,
          message: e.message,
        });
      });
  }

  async deleteRoom(call: GrpcRequest<{ id: string }>, callback: RoomResponse) {
    const { id } = call.request;

    let errorMessage: string | null = null;
    const room = await models.ChatRoom.getInstance()
      .deleteOne({
        _id: id,
      })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    models.ChatMessage.getInstance()
      .deleteMany({
        room: id,
      })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    this.grpcSdk.bus?.publish(
      'chat:delete:ChatRoom',
      JSON.stringify({
        _id: room._id,
        name: room.name,
        participants: room.participants,
      }),
    );
    callback(null, {
      result: JSON.stringify({
        _id: room._id,
        name: room.name,
        participants: room.participants,
      }),
    });
  }
}
