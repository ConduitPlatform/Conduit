import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
  ParsedRouterRequest,
  ParsedSocketRequest,
  Query,
  TYPE,
  UnparsedRouterResponse,
  UnparsedSocketResponse,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitNumber,
  ConduitObjectId,
  ConduitString,
  ConfigController,
  GrpcServer,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { ChatMessage, ChatParticipantsLog, ChatRoom, User } from '../models/index.js';
import { isArray, isNil } from 'lodash-es';
import { status } from '@grpc/grpc-js';
import { sendInvitations, validateUsersInput } from '../utils/index.js';
import { InvitationRoutes } from './InvitationRoutes.js';
import * as templates from '../templates/index.js';

export class ChatRoutes {
  private readonly _routingManager: RoutingManager;
  private invitationRoutes: InvitationRoutes;

  constructor(
    readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly sendEmail: boolean,
    private readonly sendPushNotification: boolean,
  ) {
    this._routingManager = new RoutingManager(this.grpcSdk.router!, server);
    this.invitationRoutes = new InvitationRoutes(this.grpcSdk, this._routingManager);
  }

  async registerTemplates() {
    if (
      this.grpcSdk.isAvailable('comms') &&
      this.grpcSdk.comms?.featureAvailable('email')
    ) {
      const promises = Object.values(templates).map((template: any) => {
        return this.grpcSdk.comms?.email!.registerTemplate(template);
      });
      return Promise.all(promises)
        .then(() => {
          ConduitGrpcSdk.Logger.log('Email templates registered');
        })
        .catch(() => {
          ConduitGrpcSdk.Logger.error('Internal error while registering email templates');
        });
    } else {
      ConduitGrpcSdk.Logger.error(
        'Could not register email templates, email not available',
      );
    }
  }

  async createRoom(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { roomName, users } = call.request.params;
    const { user } = call.request.context;
    let usersToBeAdded = [];
    if (isNil(users) || !isArray(users) || users.length === 0) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'users is required and must be a non-empty array',
      );
    }
    try {
      usersToBeAdded = await validateUsersInput(users);
    } catch (e) {
      throw new GrpcError(status.INTERNAL, (e as Error).message);
    }
    let room: ChatRoom;
    const query: Query<ChatRoom> = {
      name: roomName,
      creator: user._id,
      participants: [user._id],
    };
    const config = await this.grpcSdk.config.get('chat');
    if (config.explicit_room_joins.enabled) {
      room = await ChatRoom.getInstance()
        .create(query)
        .catch((e: Error) => {
          throw new GrpcError(status.INTERNAL, e.message);
        });
      const participantsLog = await ChatParticipantsLog.getInstance().create({
        user: user._id,
        action: 'create',
        chatRoom: room._id,
      });
      room = (await ChatRoom.getInstance().findByIdAndUpdate(room._id, {
        participantsLog: [participantsLog._id],
      })) as ChatRoom;
      const serverConfig = await this.grpcSdk.config.get('router');
      await sendInvitations({
        users: usersToBeAdded,
        sender: user,
        room,
        url: serverConfig.hostUrl,
        sendEmail: this.sendEmail,
        sendNotification: this.sendPushNotification,
        grpcSdk: this.grpcSdk,
      }).catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    } else {
      query['participants'] = Array.from(new Set([user._id, ...users]));
      room = await ChatRoom.getInstance()
        .create(query)
        .catch((e: Error) => {
          throw new GrpcError(status.INTERNAL, e.message);
        });
      const participantsLog = await ChatParticipantsLog.getInstance().createMany([
        {
          user: user._id,
          action: 'create',
          chatRoom: room._id,
        },
        ...users.map((userId: string) => ({
          user: userId,
          action: 'join',
          chatRoom: room._id,
        })),
      ]);
      room = (await ChatRoom.getInstance().findByIdAndUpdate(room._id, {
        participantsLog: participantsLog.map(log => log._id),
      })) as ChatRoom;
    }
    this.grpcSdk.bus?.publish(
      'chat:create:ChatRoom',
      JSON.stringify({ _id: room._id, name: roomName, participants: room.participants }),
    );
    return { roomId: room._id };
  }

  async addUsersToRoom(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { roomId, users } = call.request.params;
    const { user } = call.request.context;
    let usersToBeAdded;
    if (isNil(users) || !isArray(users) || users.length === 0) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'users is required and must be a non-empty array',
      );
    }

    const room = await this.fetchAndValidateRoomById(roomId, user._id).catch(
      (e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      },
    );
    if (room.deleted) {
      throw new GrpcError(status.NOT_FOUND, "Room doesn't exist");
    }
    try {
      usersToBeAdded = await validateUsersInput(users);
    } catch (e) {
      throw new GrpcError(status.INTERNAL, (e as Error).message);
    }

    for (const user of usersToBeAdded) {
      if (room.participants.includes(user._id))
        throw new GrpcError(
          status.ALREADY_EXISTS,
          'users array contains existing member ids',
        );
    }

    const config = await this.grpcSdk.config.get('chat');
    if (config.explicit_room_joins.enabled) {
      const serverConfig = await this.grpcSdk.config.get('router');
      const ret = await sendInvitations({
        users: usersToBeAdded,
        sender: user,
        room,
        url: serverConfig.hostUrl,
        sendEmail: this.sendEmail,
        sendNotification: this.sendPushNotification,
        grpcSdk: this.grpcSdk,
      }).catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
      return ret!;
    } else {
      const participantsLog = await ChatParticipantsLog.getInstance().createMany(
        users.map((userId: string) => ({
          user: userId,
          action: 'added',
          chatRoom: room._id,
        })),
      );
      await ChatRoom.getInstance()
        .findByIdAndUpdate(room._id, {
          participants: Array.from(new Set([...room.participants, ...users])),
          participantsLog: [
            ...room.participantsLog,
            ...participantsLog.map(log => log._id),
          ],
        })
        .catch((e: Error) => {
          throw new GrpcError(status.INTERNAL, e.message);
        });
      this.grpcSdk.bus?.publish('chat:addParticipant:ChatRoom', JSON.stringify(room));
      return 'Users added';
    }
  }

  async leaveRoom(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { roomId } = call.request.params;
    const { user } = call.request.context;

    const room = await this.fetchAndValidateRoomById(roomId, user._id).catch(
      (e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      },
    );
    if (room.deleted) {
      throw new GrpcError(status.NOT_FOUND, "Room doesn't exist");
    }

    const index = room.participants.indexOf(user._id);
    if (index > -1) {
      room.participants.splice(index, 1);
      const participantsLog = await ChatParticipantsLog.getInstance().create({
        user: user._id,
        action: 'leave',
        chatRoom: room._id,
      });

      room.participantsLog.push(participantsLog);
      if (
        (room.participants.length === 1 &&
          ConfigController.getInstance().config.deleteEmptyRooms) ||
        room.participants.length === 0
      ) {
        if (ConfigController.getInstance().config.auditMode) {
          await ChatRoom.getInstance().findByIdAndUpdate(room._id, {
            ...room,
            deleted: true,
          });
          await ChatMessage.getInstance().updateMany(
            { room: room._id },
            { deleted: true },
          );
        } else {
          await ChatRoom.getInstance().deleteOne({ _id: room._id });
          await ChatMessage.getInstance().deleteMany({ room: room._id });
        }
        this.grpcSdk.bus?.publish('chat:deleteRoom:ChatRoom', JSON.stringify({ roomId }));
      } else {
        await ChatRoom.getInstance()
          .findByIdAndUpdate(room._id, room)
          .catch((e: Error) => {
            throw new GrpcError(status.INTERNAL, e.message);
          });
      }
    }
    this.grpcSdk.bus?.publish(
      'chat:leaveRoom:ChatRoom',
      JSON.stringify({ roomId, user: user._id }),
    );

    return 'Ok';
  }

  async removeFromRoom(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { roomId } = call.request.urlParams as { roomId: string };
    const { user } = call.request.context as { user: User };
    const { users } = call.request.bodyParams as { users: string[] };

    if (users.length === 0) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Users is required and must be a non-empty array',
      );
    }

    const room = await ChatRoom.getInstance().findOne({ _id: roomId });
    if (isNil(room)) throw new GrpcError(status.NOT_FOUND, "Room doesn't exist");

    if (room.creator !== user._id)
      throw new GrpcError(
        status.PERMISSION_DENIED,
        "User doesn't have permissions to remove users from room!",
      );

    const index = (room.participants as string[]).indexOf(user._id);
    if (index > -1)
      throw new GrpcError(status.INVALID_ARGUMENT, "Users can't remove self from room!");

    for (const user of users) {
      if ((room.participants as string[]).indexOf(user) === -1)
        throw new GrpcError(status.NOT_FOUND, 'User is not participant of room!');
    }

    room.participants = (room.participants as string[]).flatMap(participant => {
      if (users.indexOf(participant) > -1) return [];
      return participant;
    });
    users.map(async user => {
      const log = await ChatParticipantsLog.getInstance().create({
        user: user,
        action: 'remove',
        chatRoom: room._id,
      });
      room.participantsLog.push(log);
    });
    await ChatRoom.getInstance()
      .findByIdAndUpdate(room._id, room)
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

    return 'OK';
  }

  async getMessages(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { roomId, skip, limit } = call.request.params;
    const { user } = call.request.context;
    let messagesPromise;
    let countPromise;
    if (isNil(roomId)) {
      const rooms = await ChatRoom.getInstance()
        .findMany({ participants: user._id, deleted: false })
        .catch((e: Error) => {
          throw new GrpcError(status.INTERNAL, e.message);
        });
      const query = {
        room: { $in: rooms.map((room: ChatRoom) => room._id) },
        deleted: false,
      };
      messagesPromise = ChatMessage.getInstance().findMany(
        query,
        undefined,
        skip,
        limit,
        { createdAt: -1 },
      );
      countPromise = ChatMessage.getInstance().countDocuments(query);
    } else {
      const room = await this.fetchAndValidateRoomById(roomId, user._id).catch(
        (e: Error) => {
          throw new GrpcError(status.INTERNAL, e.message);
        },
      );
      if (room.deleted) {
        throw new GrpcError(status.NOT_FOUND, "Room doesn't exist");
      }
      messagesPromise = ChatMessage.getInstance()
        .findMany(
          {
            room: roomId,
            deleted: false,
          },
          undefined,
          skip,
          limit,
          { createdAt: -1 },
        )
        .catch((e: Error) => {
          throw new GrpcError(status.INTERNAL, e.message);
        });
      countPromise = ChatMessage.getInstance().countDocuments({
        room: roomId,
        deleted: false,
      });
    }

    const [messages, count] = await Promise.all([messagesPromise, countPromise]).catch(
      (e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      },
    );
    return { messages, count };
  }

  async getMessage(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { messageId } = call.request.params;
    const { user } = call.request.context;
    const message = await ChatMessage.getInstance()
      .findOne({ _id: messageId, deleted: false }, undefined, ['room'])
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    if (!message || (message.room as ChatRoom).participants.indexOf(user._id) === -1) {
      throw new GrpcError(
        status.NOT_FOUND,
        "Message does not exist or you don't have access",
      );
    }
    return message;
  }

  async getRooms(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { skip, limit, populate } = call.request.params;
    const { user } = call.request.context;
    const rooms = await ChatRoom.getInstance()
      .findMany(
        { participants: user._id, deleted: false },
        undefined,
        skip,
        limit,
        undefined,
        populate,
      )
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    const roomsCount = await ChatRoom.getInstance()
      .countDocuments({ participants: user._id, deleted: false })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    return { rooms, count: roomsCount };
  }

  async getRoom(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, populate } = call.request.params;
    const { user } = call.request.context;
    const room = await ChatRoom.getInstance()
      .findOne({ _id: id, participants: user._id, deleted: false }, undefined, populate)
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    if (!room) {
      throw new GrpcError(
        status.NOT_FOUND,
        "Room does not exist or you don't have access",
      );
    }
    return room;
  }

  async deleteMessage(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { messageId } = call.request.params;
    const { user } = call.request.context;
    const message = await ChatMessage.getInstance()
      .findOne({ _id: messageId, deleted: false })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    if (isNil(message) || message.senderUser !== user._id) {
      throw new GrpcError(
        status.NOT_FOUND,
        "Message does not exist or you don't have access",
      );
    }
    if (ConfigController.getInstance().config.auditMode) {
      await ChatMessage.getInstance()
        .findByIdAndUpdate(messageId, { deleted: true })
        .catch((e: Error) => {
          throw new GrpcError(status.INTERNAL, e.message);
        });
    } else {
      await ChatMessage.getInstance()
        .deleteOne({ _id: messageId })
        .catch((e: Error) => {
          throw new GrpcError(status.INTERNAL, e.message);
        });
    }

    this.grpcSdk.bus?.publish('chat:delete:ChatMessage', JSON.stringify(messageId));
    return 'Message deleted successfully';
  }

  async patchMessage(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { messageId, newMessage } = call.request.params;
    const { user } = call.request.context;
    const message: ChatMessage | null = await ChatMessage.getInstance()
      .findOne({ _id: messageId, deleted: false })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    if (isNil(message) || message.senderUser !== user._id) {
      throw new GrpcError(
        status.NOT_FOUND,
        "Message does not exist or you don't have access",
      );
    }
    message.message = newMessage;
    await ChatMessage.getInstance()
      .findByIdAndUpdate(message._id, { message: message.message })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    this.grpcSdk.bus?.publish(
      'chat:edit:ChatMessage',
      JSON.stringify({ id: messageId, newMessage: message }),
    );
    return 'Message updated successfully';
  }

  async connect(call: ParsedSocketRequest): Promise<UnparsedSocketResponse> {
    const { user } = call.request.context;
    const rooms = await ChatRoom.getInstance().findMany({ participants: user._id });
    return { rooms: rooms.map((room: ChatRoom) => room._id) };
  }

  async onMessage(call: ParsedSocketRequest): Promise<UnparsedSocketResponse> {
    const { user } = call.request.context;
    const [roomId, message] = call.request.params;
    const room = await ChatRoom.getInstance().findOne({ _id: roomId, deleted: false });

    if (isNil(room) || !room.participants.includes(user._id)) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        "Room does not exist or you don't have access",
      );
    }

    await ChatMessage.getInstance().create({
      message,
      senderUser: user._id,
      room: roomId,
      readBy: [user._id],
    });
    ConduitGrpcSdk.Metrics?.increment('messages_sent_total');
    return {
      event: 'message',
      receivers: [roomId],
      data: { sender: user._id, message, room: roomId },
    };
  }

  async onMessagesRead(call: ParsedSocketRequest): Promise<UnparsedSocketResponse> {
    const user: User = call.request.context.user;
    const [roomId] = call.request.params;
    const room = await ChatRoom.getInstance().findOne({ _id: roomId, deleted: false });
    if (isNil(room) || !(room.participants as string[]).includes(user._id)) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        "Room does not exist or you don't have access",
      );
    }

    const filterQuery = {
      room: room._id,
      readBy: { $ne: user._id },
    };

    await ChatMessage.getInstance().updateMany(filterQuery, {
      $push: { readBy: user._id },
    });
    return {
      event: 'messagesRead',
      receivers: [room._id],
      data: { room: room._id, readBy: user._id },
    };
  }

  async registerRoutes() {
    this._routingManager.clear();

    this._routingManager.route(
      {
        path: '/rooms',
        action: ConduitRouteActions.POST,
        description: `Creates a new room.`,
        bodyParams: {
          roomName: ConduitString.Required,
          users: [ConduitObjectId.Required],
        },
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('CreateRoom', {
        roomId: ConduitString.Required,
      }),
      this.createRoom.bind(this),
    );

    this._routingManager.route(
      {
        path: '/rooms/:roomId/addUsers',
        action: ConduitRouteActions.UPDATE,
        description: `Adds users to a chat room.`,
        urlParams: {
          roomId: ConduitObjectId.Required,
        },
        bodyParams: {
          users: [TYPE.String],
        },
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('AddUsersToRoomResponse', 'String'),
      this.addUsersToRoom.bind(this),
    );

    this._routingManager.route(
      {
        path: '/leave/:roomId',
        action: ConduitRouteActions.UPDATE,
        description: `Context user leaves chat room.`,
        urlParams: {
          roomId: ConduitObjectId.Required,
        },
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('LeaveRoom', 'String'),
      this.leaveRoom.bind(this),
    );

    this._routingManager.route(
      {
        path: '/room/:roomId/remove',
        action: ConduitRouteActions.UPDATE,
        description: `Room Creator removes users from chat room.`,
        urlParams: {
          roomId: ConduitObjectId.Required,
        },
        bodyParams: {
          users: [ConduitObjectId.Required],
        },
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('RemoveFromRoomResponse', 'String'),
      this.removeFromRoom.bind(this),
    );

    this._routingManager.route(
      {
        path: '/rooms/:id',
        action: ConduitRouteActions.GET,
        description: `Returns a chat room.`,
        urlParams: {
          id: ConduitObjectId.Required,
        },
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition(ChatRoom.name),
      this.getRoom.bind(this),
    );
    this._routingManager.route(
      {
        path: '/rooms',
        action: ConduitRouteActions.GET,
        description: `Returns queried chat rooms.`,
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
        },
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('ChatRoomsResponse', {
        rooms: [ChatRoom.name],
        count: ConduitNumber.Required,
      }),
      this.getRooms.bind(this),
    );

    this._routingManager.route(
      {
        path: '/messages/:messageId',
        action: ConduitRouteActions.GET,
        description: `Returns a message.`,
        urlParams: {
          messageId: ConduitString.Required,
        },
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition(ChatMessage.name),
      this.getMessage.bind(this),
    );

    this._routingManager.route(
      {
        path: '/messages',
        action: ConduitRouteActions.GET,
        description: `Returns queried messages and their total count.`,
        queryParams: {
          roomId: ConduitString.Optional,
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
        },
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('ChatMessagesResponse', {
        messages: [ChatMessage.name],
        count: ConduitNumber.Required,
      }),
      this.getMessages.bind(this),
    );

    const config = await this.grpcSdk.config.get('chat');
    if (config.allowMessageDelete) {
      this._routingManager.route(
        {
          path: '/messages/:messageId',
          action: ConduitRouteActions.DELETE,
          description: `Deletes a message.`,
          urlParams: {
            messageId: ConduitString.Required,
          },
          middlewares: ['authMiddleware'],
        },
        new ConduitRouteReturnDefinition('DeleteMessageResponse', 'String'),
        this.deleteMessage.bind(this),
      );
    }

    if (config.allowMessageEdit) {
      this._routingManager.route(
        {
          path: '/messages/:messageId',
          action: ConduitRouteActions.UPDATE,
          description: `Updates content of a message.`,
          urlParams: {
            messageId: ConduitString.Required,
          },
          bodyParams: {
            newMessage: ConduitString.Required,
          },
          middlewares: ['authMiddleware'],
        },
        new ConduitRouteReturnDefinition('PatchMessageResponse', 'String'),
        this.patchMessage.bind(this),
      );
    }

    if (config.explicit_room_joins.enabled) {
      if (this.sendEmail) await this.registerTemplates();
      this.invitationRoutes.declareRoutes();
    }

    // TODO refactor socket registration process.
    this._routingManager.socket(
      {
        path: '/',
        middlewares: ['authMiddleware'],
      },
      {
        connect: {
          handler: this.connect.bind(this),
        },
        message: {
          handler: this.onMessage.bind(this),
          params: [TYPE.String, TYPE.String],
          returnType: new ConduitRouteReturnDefinition('MessageResponse', {
            sender: TYPE.String,
            message: TYPE.String,
            room: TYPE.String,
          }),
        },
        messagesRead: {
          handler: this.onMessagesRead.bind(this),
          params: [TYPE.String],
          returnType: new ConduitRouteReturnDefinition('MessagesReadResponse', {
            room: TYPE.String,
            readBy: TYPE.String,
          }),
        },
      },
    );
    return this._routingManager.registerRoutes();
  }

  private async fetchAndValidateRoomById(
    roomId: string,
    userId: string & User,
  ): Promise<ChatRoom> {
    const room = await ChatRoom.getInstance()
      .findOne({ _id: roomId })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    if (isNil(room) || !room.participants.includes(userId)) {
      throw new GrpcError(
        status.NOT_FOUND,
        "Room does not exist or you don't have access",
      );
    }
    return room;
  }
}
