import {
  ConduitGrpcSdk,
  DatabaseProvider,
  GrpcCallback,
  GrpcError,
  GrpcRequest,
  HealthCheckStatus,
} from '@conduitplatform/grpc-sdk';

import AppConfigSchema, { Config } from './config/index.js';
import { AdminHandlers } from './admin/index.js';
import { ChatRoutes } from './routes/index.js';
import * as models from './models/index.js';
import { validateUsersInput } from './utils/index.js';
import { MessageType } from './enums/messageType.enum.js';
import path from 'path';
import { isArray, isNil } from 'lodash-es';
import { status } from '@grpc/grpc-js';
import { runMigrations } from './migrations/index.js';
import {
  CreateRoomRequest,
  DeleteRoomRequest,
  Room,
  SendMessageRequest,
} from './protoTypes/chat.js';
import metricsSchema from './metrics/index.js';
import {
  ConduitActiveSchema,
  ConfigController,
  ManagedModule,
} from '@conduitplatform/module-tools';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class Chat extends ManagedModule<Config> {
  configSchema = AppConfigSchema;
  service = {
    protoPath: path.resolve(__dirname, 'chat.proto'),
    protoDescription: 'chat.Chat',
    functions: {
      createRoom: this.createRoom.bind(this),
      deleteRoom: this.deleteRoom.bind(this),
      sendMessage: this.sendMessage.bind(this),
    },
  };
  protected metricsSchema = metricsSchema;
  private adminRouter: AdminHandlers;
  private userRouter: ChatRoutes;
  private database: DatabaseProvider;
  private _emailServing: boolean;
  private _pushNotificationsServing: boolean;

  constructor() {
    super('chat');
    this.updateHealth(HealthCheckStatus.UNKNOWN, true);
  }

  private _sendEmail: boolean;

  private get sendEmail() {
    return this._sendEmail && this._emailServing;
  }

  private _sendPushNotification: boolean;

  private get sendPushNotification() {
    return this._sendPushNotification && this._pushNotificationsServing;
  }

  async onServerStart() {
    await this.grpcSdk.waitForExistence('database');
    this.database = this.grpcSdk.database!;
    await this.registerSchemas();
    await runMigrations(this.grpcSdk);
    await this.grpcSdk.monitorModule('authentication', serving => {
      this.updateHealth(
        serving ? HealthCheckStatus.SERVING : HealthCheckStatus.NOT_SERVING,
      );
    });
  }

  async onConfig() {
    const config = await ConfigController.getInstance().config;
    if (!config.active) {
      this.updateHealth(HealthCheckStatus.NOT_SERVING);
    } else {
      this._sendEmail =
        config.explicit_room_joins.enabled && config.explicit_room_joins.send_email;
      if (this._sendEmail) {
        await this.grpcSdk.monitorModule('email', serving => {
          this._emailServing = serving;
          this.refreshAppRoutes(); // redundant while called directly by onConfig() with sendPushNotification === true
        });
      } else {
        this.grpcSdk.unmonitorModule('email');
      }
      this._sendPushNotification =
        config.explicit_room_joins.enabled &&
        config.explicit_room_joins.send_notification;
      if (this._sendPushNotification) {
        await this.grpcSdk.monitorModule('pushNotifications', serving => {
          this._pushNotificationsServing = serving;
          this.refreshAppRoutes();
        });
      } else {
        this.grpcSdk.unmonitorModule('pushNotifications');
      }
      this.adminRouter = new AdminHandlers(this.grpcServer, this.grpcSdk);
      if (!this._sendEmail && !this._sendPushNotification) {
        // avoid redundant refreshes
        await this.refreshAppRoutes();
      }
      this.updateHealth(HealthCheckStatus.SERVING);
    }
  }

  async initializeMetrics() {
    const roomsTotal = await models.ChatRoom.getInstance().countDocuments({});
    const messagesTotal = await models.ChatMessage.getInstance().countDocuments({});
    ConduitGrpcSdk.Metrics?.set('chat_rooms_total', roomsTotal);
    ConduitGrpcSdk.Metrics?.increment('messages_sent_total', messagesTotal);
  }

  // gRPC Service
  async createRoom(call: GrpcRequest<CreateRoomRequest>, callback: GrpcCallback<Room>) {
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
      return callback({ code: (e as GrpcError).code, message: (e as GrpcError).message });
    }

    const errorMessage: string | null = null;
    const room: models.ChatRoom = await models.ChatRoom.getInstance().create({
      name: name,
      participants: participants,
    });
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }
    this.grpcSdk.router?.socketPush({
      event: 'join-room',
      receivers: room.participants as string[],
      rooms: [room._id],
    });
    this.grpcSdk.router?.socketPush({
      event: 'room-joined',
      receivers: room.participants as string[],
      rooms: [],
      data: JSON.stringify({ room: room._id, roomName: room.name }),
    });
    this.grpcSdk.bus?.publish(
      'chat:create:ChatRoom',
      JSON.stringify({
        name: (room as models.ChatRoom).name,
        participants: (room as models.ChatRoom).participants,
      }),
    );
    callback(null, {
      _id: room._id,
      name: room.name,
      participants: room.participants as string[],
    });
  }

  async sendMessage(call: GrpcRequest<SendMessageRequest>, callback: GrpcCallback<null>) {
    const userId = call.request.userId;
    const { roomId, message, messageType } = call.request;

    let errorMessage: string | null = null;
    const room = await models.ChatRoom.getInstance()
      .findOne({ _id: roomId })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    // @ts-ignore
    if (isNil(room) || !room.participants.includes(userId)) {
      return callback({ code: status.INVALID_ARGUMENT, message: 'invalid room' });
    }

    models.ChatMessage.getInstance()
      .create({
        message,
        messageType: messageType || MessageType.Text,
        senderUser: userId,
        room: roomId,
        readBy: [userId],
      })
      .then(() => {
        return this.grpcSdk.router?.socketPush({
          event: 'message',
          receivers: [],
          rooms: [roomId],
          data: JSON.stringify({
            sender: userId,
            message,
            room: roomId,
            contentType: messageType || MessageType.Text,
          }),
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

  async deleteRoom(call: GrpcRequest<DeleteRoomRequest>, callback: GrpcCallback<Room>) {
    const { _id } = call.request;

    let errorMessage: string | null = null;
    const room: models.ChatRoom = await models.ChatRoom.getInstance()
      .deleteOne({ _id })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    models.ChatMessage.getInstance()
      .deleteMany({
        room: _id,
      })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }
    this.grpcSdk.router
      ?.socketPush({
        event: 'room-deleted',
        receivers: [],
        rooms: [room._id],
        data: JSON.stringify({ room: room._id, roomName: room.name }),
      })
      ?.then(() => {
        this.grpcSdk.router?.socketPush({
          event: 'leave-room',
          receivers: room.participants as string[],
          rooms: [room._id],
        });
      })
      ?.catch(err => ConduitGrpcSdk.Logger.error(err));

    this.grpcSdk.bus?.publish(
      'chat:delete:ChatRoom',
      JSON.stringify({
        _id: room._id,
        name: room.name,
        participants: room.participants,
      }),
    );
    callback(null, {
      _id: room._id,
      name: room.name,
      participants: room.participants as string[],
    });
  }

  protected registerSchemas(): Promise<unknown> {
    const promises = Object.values(models).map(model => {
      const modelInstance = model.getInstance(this.database);
      //TODO: add support for multiple schemas types
      if (
        Object.keys((modelInstance as ConduitActiveSchema<typeof modelInstance>).fields)
          .length !== 0
      ) {
        // borrowed foreign model
        return this.database
          .createSchemaFromAdapter(modelInstance)
          .then(() => this.database.migrate(modelInstance.name));
      }
    });
    return Promise.all(promises);
  }

  private async refreshAppRoutes() {
    if (this.userRouter) {
      await this.userRouter.registerRoutes();
      return;
    }
    this.grpcSdk
      .waitForExistence('router')
      .then(() => {
        this.userRouter = new ChatRoutes(
          this.grpcServer,
          this.grpcSdk,
          this.sendEmail,
          this.sendPushNotification,
        );
        return this.userRouter.registerRoutes();
      })
      .catch(e => {
        ConduitGrpcSdk.Logger.error(e.message);
      });
  }
}
