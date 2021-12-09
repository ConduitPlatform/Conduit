import {
  ConduitServiceModule,
  DatabaseProvider,
  GrpcServer,
  SetConfigRequest,
  SetConfigResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import ChatConfigSchema from './config';
import { status } from '@grpc/grpc-js';
import path from 'path';
import { isArray, isNil } from 'lodash';
import { ChatRoutes } from './routes/Routes';
import * as models from './models';
import { ChatMessage, ChatRoom } from './models';
import { AdminHandlers } from './admin/admin';
import { validateUsersInput } from './utils';

export default class ChatModule extends ConduitServiceModule {
  private database: DatabaseProvider;
  private _admin: AdminHandlers;
  private isRunning: boolean = false;
  private _router: ChatRoutes;

  async initialize() {
    this.grpcServer = new GrpcServer(process.env.SERVICE_URL);
    this._port = (await this.grpcServer.createNewServer()).toString();
    await this.grpcServer.addService(
      path.resolve(__dirname, './chat.proto'),
      'chat.Chat',
      {
        setConfig: this.setConfig.bind(this),
        createRoom: this.createRoom.bind(this),
        deleteRoom: this.deleteRoom.bind(this),
        sendMessage: this.sendMessage.bind(this),
      }
    );
    await this.grpcServer.start();
  }

  async createRoom(call: any, callback: any) {
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
      })
    );
    callback(null, {
      result: JSON.stringify({
        _id: (room as models.ChatRoom)._id,
        name: (room as models.ChatRoom).name,
        participants: (room as models.ChatRoom).participants,
      }),
    });
  }

  async sendMessage(call: any, callback: any) {
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

  async deleteRoom(call: any, callback: any) {
    const { id } = call.request;

    let errorMessage: string | null = null;
    const room: any = await models.ChatRoom.getInstance()
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
      })
    );
    callback(null, {
      result: JSON.stringify({
        _id: room._id,
        name: room.name,
        participants: room.participants,
      }),
    });
  }

  async activate() {
    await this.grpcSdk.waitForExistence('database-provider');
    await this.grpcSdk.initializeEventBus();
    this.grpcSdk.bus?.subscribe('chat', (message: string) => {
      if (message === 'config-update') {
        this.enableModule()
          .then(() => {
            console.log('Updated chat configuration');
          })
          .catch(() => {
            console.log('Failed to update chat config');
          });
      }
    });
    try {
      await this.grpcSdk.config.get('chat');
    } catch (e) {
      await this.grpcSdk.config.updateConfig(ChatConfigSchema.getProperties(), 'chat');
    }
    let config = await this.grpcSdk.config.addFieldstoConfig(
      ChatConfigSchema.getProperties(),
      'chat'
    );
    if (config.active) await this.enableModule();
  }

  async setConfig(call: SetConfigRequest, callback: SetConfigResponse) {
    const newConfig = JSON.parse(call.request.newConfig);
    try {
      ChatConfigSchema.load(newConfig).validate();
    } catch (e) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Module is not active',
      });
    }

    let errorMessage: string | null = null;
    const updateResult = await this.grpcSdk.config
      .updateConfig(newConfig, 'chat')
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    const chatConfig = await this.grpcSdk.config.get('chat');
    if (chatConfig.active) {
      await this.enableModule().catch((e: Error) => (errorMessage = e.message));
      if (!isNil(errorMessage)) {
        return callback({ code: status.INTERNAL, message: errorMessage });
      }
      this.grpcSdk.bus?.publish('chat', 'config-update');
    } else {
      return callback({
        code: status.FAILED_PRECONDITION,
        message: 'Module is not active',
      });
    }
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    return callback(null, { updatedConfig: JSON.stringify(updateResult) });
  }

  private async enableModule() {
    if (!this.isRunning) {
      this.database = this.grpcSdk.databaseProvider!;
      await this.registerSchemas();
      this._router = new ChatRoutes(this.grpcServer, this.grpcSdk);
      this._admin = new AdminHandlers(this.grpcServer, this.grpcSdk);
      this.isRunning = true;
    }
    await this._router.registerRoutes();
  }

  private registerSchemas() {
    const promises = Object.values(models).map((model: any) => {
      let modelInstance = model.getInstance(this.database);
      return this.database.createSchemaFromAdapter(modelInstance);
    });
    return Promise.all(promises);
  }
}
