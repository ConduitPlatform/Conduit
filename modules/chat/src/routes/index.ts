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
  ConduitString,
  ConduitObjectId,
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
import { MessageType } from '../enums/messageType.enum.js';

// Redis TTL for chat message nonce deduplication.
const CHAT_NONCE_TTL_MS = 5 * 60 * 1000;

export class ChatRoutes {
  private readonly _routingManager: RoutingManager;
  private invitationRoutes: InvitationRoutes;
  /** Updated on each registerRoutes — used by handlers so invitation sends follow live peer state. */
  private inviteSendEmail = false;
  private inviteSendPush = false;

  constructor(
    readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
  ) {
    this._routingManager = new RoutingManager(this.grpcSdk.router!, server);
    this.invitationRoutes = new InvitationRoutes(this.grpcSdk, this._routingManager);
  }

  async registerTemplates() {
    this.grpcSdk.config
      .get('email')
      .then(() => {
        const promises = Object.values(templates).map((template: any) => {
          return this.grpcSdk.emailProvider!.registerTemplate(template);
        });
        return Promise.all(promises);
      })
      .then(() => {
        ConduitGrpcSdk.Logger.log('Email templates registered');
      })
      .catch(() => {
        ConduitGrpcSdk.Logger.error('Internal error while registering email templates');
      });
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
      usersToBeAdded = await validateUsersInput(this.grpcSdk, users);
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
      await sendInvitations(
        usersToBeAdded,
        user,
        room,
        serverConfig.hostUrl,
        this.inviteSendEmail,
        this.inviteSendPush,
        this.grpcSdk,
      ).catch((e: Error) => {
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
          action: 'join' as 'join',
          chatRoom: room._id,
        })),
      ]);
      room = (await ChatRoom.getInstance().findByIdAndUpdate(room._id, {
        participantsLog: participantsLog.map(log => log._id),
      })) as ChatRoom;
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
      usersToBeAdded = await validateUsersInput(this.grpcSdk, users);
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
      const ret = await sendInvitations(
        usersToBeAdded,
        user,
        room,
        serverConfig.hostUrl,
        this.inviteSendEmail,
        this.inviteSendPush,
        this.grpcSdk,
      ).catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
      return ret!;
    } else {
      const participantsLog = await ChatParticipantsLog.getInstance().createMany(
        users.map((userId: string) => ({
          user: userId,
          action: 'join' as 'join',
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
      this.grpcSdk.router?.socketPush({
        event: 'join-room',
        receivers: users,
        rooms: [room._id],
      });
      this.grpcSdk.router?.socketPush({
        event: 'room-joined',
        receivers: users,
        rooms: [],
        data: JSON.stringify({ room: room._id, roomName: room.name }),
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
        action: 'leave' as 'leave',
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
      this.grpcSdk.router?.socketPush({
        event: 'leave-room',
        receivers: [user._id],
        rooms: [roomId],
      });
    }
    this.grpcSdk.bus?.publish(
      'chat:leaveRoom:ChatRoom',
      JSON.stringify({ roomId, user: user._id }),
    );

    return 'Ok';
  }

  async getMessages(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { roomId, skip, limit, populate } = call.request.params;
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
      messagesPromise = ChatMessage.getInstance().findMany(query, {
        skip,
        limit,
        sort: { createdAt: -1 },
        populate,
      });
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
          {
            skip,
            limit,
            sort: { createdAt: -1 },
            populate,
          },
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
      .findOne({ _id: messageId, deleted: false }, { populate: ['room'] })
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
      .findMany({ participants: user._id, deleted: false }, { skip, limit, populate })
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
      .findOne({ _id: id, participants: user._id, deleted: false }, { populate })
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

    this.grpcSdk.router?.socketPush({
      event: 'message-deleted',
      receivers: [],
      rooms: [message.room as string],
      data: JSON.stringify({ messageId, room: message.room }),
    });

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

    this.grpcSdk.router?.socketPush({
      event: 'message-edited',
      receivers: [],
      rooms: [message.room as string],
      data: JSON.stringify({
        messageId,
        message: newMessage,
        room: message.room,
      }),
    });

    this.grpcSdk.bus?.publish(
      'chat:edit:ChatMessage',
      JSON.stringify({ id: messageId, newMessage }),
    );
    return 'Message updated successfully';
  }

  async connect(call: ParsedSocketRequest): Promise<UnparsedSocketResponse> {
    const { user } = call.request.context;
    const rooms = await ChatRoom.getInstance().findMany({ participants: user._id });
    return { event: 'join-room', rooms: rooms.map((room: ChatRoom) => room._id) };
  }

  async connectToRoom(call: ParsedSocketRequest): Promise<UnparsedSocketResponse> {
    const { user } = call.request.context;
    const [roomId] = call.request.params;
    const rooms = await ChatRoom.getInstance().findMany({
      _id: roomId,
      participants: user._id,
    });
    if (!rooms || rooms.length === 0) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        "Room does not exist or you don't have access",
      );
    }
    return { event: 'join-room', rooms: rooms.map((room: ChatRoom) => room._id) };
  }

  async onMessage(call: ParsedSocketRequest): Promise<UnparsedSocketResponse> {
    const { user } = call.request.context;
    const [roomId, message] = call.request.params;
    const room = await ChatRoom.getInstance().findOne({
      _id: roomId,
      deleted: false,
      participants: user._id,
    });

    if (isNil(room)) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        "Room does not exist or you don't have access",
      );
    }
    let formattedMessage: {
      contentType: string;
      content?: string;
      files?: string[];
    };
    let nonce: string | undefined;
    if (typeof message === 'string') {
      formattedMessage = {
        content: message,
        contentType: 'text',
      };
    } else {
      if (!message.hasOwnProperty('contentType')) {
        throw new GrpcError(
          status.INVALID_ARGUMENT,
          'Message must contain contentType property',
        );
      }
      if (
        !['text', 'file', 'typing', 'multimedia', 'system'].includes(message.contentType)
      ) {
        throw new GrpcError(
          status.INVALID_ARGUMENT,
          'Invalid contentType, must be one of: text, file, typing, multimedia, system',
        );
      }
      if (
        [MessageType.File, MessageType.Multimedia].includes(message.contentType) &&
        !message.files
      ) {
        throw new GrpcError(
          status.INVALID_ARGUMENT,
          `Files are required for ${message.contentType} messages`,
        );
      }
      if (
        [MessageType.File, MessageType.Multimedia].includes(message.contentType) &&
        !Array.isArray(message.files)
      ) {
        throw new GrpcError(
          status.INVALID_ARGUMENT,
          `Files must be an array for ${message.contentType} messages`,
        );
      }
      if (
        [MessageType.Text, MessageType.Multimedia, MessageType.System].includes(
          message.contentType,
        ) &&
        !message.content
      ) {
        throw new GrpcError(
          status.INVALID_ARGUMENT,
          `${message.contentType} messages need to have content`,
        );
      }
      if (Object.hasOwn(message, 'nonce')) {
        const n = (message as { nonce?: unknown }).nonce;
        if (typeof n !== 'string' || n.length === 0) {
          throw new GrpcError(
            status.INVALID_ARGUMENT,
            'When provided, nonce must be a non-empty string',
          );
        }
        nonce = n;
      }
      formattedMessage = message as any;
    }

    if (formattedMessage.contentType === MessageType.Typing) {
      return {
        event: 'message',
        receivers: [],
        rooms: [roomId as string],
        data: { sender: user._id, contentType: MessageType.Typing, room: roomId },
      };
    }

    if (nonce) {
      const existing = await this.checkNonceDedup(roomId as string, user._id, nonce);
      if (existing) {
        // Retry / idempotent resend: only notify the sender so other clients are not duplicated.
        return {
          event: 'message',
          receivers: [user._id],
          rooms: [],
          data: {
            _id: existing._id,
            nonce,
            sender: user._id,
            contentType: existing.messageType,
            content: existing.message,
            files: existing.files,
            room: roomId,
          },
        };
      }
    }

    const messageId = await this.grpcSdk.database!.generateId();
    const createdAt = new Date().toISOString();

    const createPayload = {
      _id: messageId,
      message: formattedMessage.content ?? '',
      messageType: formattedMessage.contentType || MessageType.Text,
      files: formattedMessage.files || [],
      senderUser: user._id,
      room: roomId,
      readBy: [user._id],
    };

    ChatMessage.getInstance()
      .create(createPayload)
      .then(created => {
        if (nonce) {
          this.recordNonce(roomId as string, user._id, nonce, created._id);
        }
        ConduitGrpcSdk.Metrics?.increment('messages_sent_total');
      })
      .catch(err => {
        ConduitGrpcSdk.Logger.error(
          `Failed to persist message ${messageId} in room ${roomId}: ${err.message}`,
        );
        this.grpcSdk.router?.socketPush({
          event: 'message:error',
          receivers: [user._id],
          rooms: [],
          data: JSON.stringify({
            _id: messageId,
            room: roomId,
            error: 'Message could not be saved',
          }),
        });
      });

    return {
      event: 'message',
      receivers: [],
      rooms: [roomId as string],
      data: {
        _id: messageId,
        nonce,
        sender: user._id,
        contentType: formattedMessage.contentType,
        content: formattedMessage.content,
        files: formattedMessage.files,
        room: roomId,
        createdAt,
      },
    };
  }

  async onMessagesRead(call: ParsedSocketRequest): Promise<UnparsedSocketResponse> {
    const user: User = call.request.context.user;
    const [roomId] = call.request.params;
    const room = await ChatRoom.getInstance().findOne({
      _id: roomId,
      deleted: false,
      participants: user._id,
    });
    if (isNil(room)) {
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
      receivers: [],
      rooms: [room._id],
      data: { room: room._id, readBy: user._id },
    };
  }

  async registerRoutes(sendEmail: boolean, sendPushNotification: boolean) {
    this.inviteSendEmail = sendEmail;
    this.inviteSendPush = sendPushNotification;
    this._routingManager.clear();

    this._routingManager.route(
      {
        path: '/rooms',
        action: ConduitRouteActions.POST,
        description: `Creates a new room.`,
        bodyParams: {
          roomName: ConduitString.Required,
          users: [TYPE.String],
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
          roomId: ConduitString.Required,
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
        description: `Removes current user from a chat room.`,
        urlParams: {
          roomId: ConduitString.Required,
        },
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('LeaveRoom', 'String'),
      this.leaveRoom.bind(this),
    );

    this._routingManager.route(
      {
        path: '/rooms/:id',
        action: ConduitRouteActions.GET,
        description: `Returns a chat room.`,
        urlParams: {
          id: ConduitString.Required,
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
          populate: [ConduitString.Optional],
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
      if (sendEmail) await this.registerTemplates();
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
        connectToRoom: {
          params: [TYPE.String],
          handler: this.connectToRoom.bind(this),
        },
        message: {
          handler: this.onMessage.bind(this),
          params: [TYPE.String, TYPE.JSON],
          returnType: new ConduitRouteReturnDefinition('MessageResponse', {
            _id: ConduitObjectId.Optional,
            nonce: ConduitString.Optional,
            sender: TYPE.String,
            content: ConduitString.Optional,
            contentType: ConduitString.Optional,
            files: [ConduitString.Optional],
            room: TYPE.String,
            createdAt: ConduitString.Optional,
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

  private async checkNonceDedup(
    roomId: string,
    userId: string,
    nonce: string,
  ): Promise<ChatMessage | null> {
    if (!this.grpcSdk.state) return null;
    const key = `chat:nonce:${roomId}:${userId}:${nonce}`;
    const existingId = await this.grpcSdk.state.getKey(key);
    if (!existingId) return null;
    const existing = await ChatMessage.getInstance().findOne(
      {
        _id: existingId,
        deleted: false,
        senderUser: userId,
        room: roomId,
      },
      { readPreference: 'primary' },
    );
    return existing ?? null;
  }

  private async recordNonce(
    roomId: string,
    userId: string,
    nonce: string,
    messageId: string,
  ): Promise<void> {
    if (!this.grpcSdk.state) return;
    const key = `chat:nonce:${roomId}:${userId}:${nonce}`;
    await this.grpcSdk.state.setKey(key, messageId, CHAT_NONCE_TTL_MS);
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
