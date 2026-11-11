import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
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
  ModuleError,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { ChatMessage, ChatParticipantsLog, ChatRoom, User } from '../models/index.js';
import { isArray, isNil } from 'lodash-es';
import { errors } from '../errors.js';
import {
  deleteChatMessage,
  editChatMessage,
  sendInvitations,
  validateUsersInput,
} from '../utils/index.js';
import {
  getMembershipCacheKey,
  MEMBERSHIP_CACHE_TTL_MS,
  invalidateMembershipCache,
} from '../utils/membershipCache.js';
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
  private pendingReads = new Map<
    string,
    { userIds: Set<string>; timer: ReturnType<typeof setTimeout> }
  >();

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
      throw new ModuleError(errors.USERS_REQUIRED);
    }
    usersToBeAdded = await validateUsersInput(this.grpcSdk, users);
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
        .catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));
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
      ).catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));
    } else {
      query['participants'] = Array.from(new Set([user._id, ...users]));
      room = await ChatRoom.getInstance()
        .create(query)
        .catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));
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
    if (isNil(users) || !isArray(users) || users.length === 0) {
      throw new ModuleError(errors.USERS_REQUIRED);
    }

    const room = await this.fetchAndValidateRoomById(roomId, user._id).catch(
      ModuleError.rethrow(errors.CHAT_DATABASE_ERROR),
    );
    if (room.deleted) {
      throw new ModuleError(errors.ROOM_NOT_FOUND);
    }
    const usersToBeAdded = await validateUsersInput(this.grpcSdk, users);

    for (const user of usersToBeAdded) {
      if (room.participants.includes(user._id))
        throw new ModuleError(errors.USERS_ALREADY_IN_ROOM);
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
      ).catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));
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
        .catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));
      await invalidateMembershipCache(this.grpcSdk, room._id);
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
      ModuleError.rethrow(errors.CHAT_DATABASE_ERROR),
    );
    if (room.deleted) {
      throw new ModuleError(errors.ROOM_NOT_FOUND);
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
          .catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));
      }
      await invalidateMembershipCache(this.grpcSdk, room._id);
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
        .catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));
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
        ModuleError.rethrow(errors.CHAT_DATABASE_ERROR),
      );
      if (room.deleted) {
        throw new ModuleError(errors.ROOM_NOT_FOUND);
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
        .catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));
      countPromise = ChatMessage.getInstance().countDocuments({
        room: roomId,
        deleted: false,
      });
    }

    const [messages, count] = await Promise.all([messagesPromise, countPromise]).catch(
      ModuleError.rethrow(errors.CHAT_DATABASE_ERROR),
    );
    return { messages, count };
  }

  async getMessage(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { messageId } = call.request.params;
    const { user } = call.request.context;
    const message = await ChatMessage.getInstance()
      .findOne({ _id: messageId, deleted: false }, { populate: ['room'] })
      .catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));
    if (!message || (message.room as ChatRoom).participants.indexOf(user._id) === -1) {
      throw new ModuleError(errors.MESSAGE_NOT_FOUND);
    }
    return message;
  }

  async getRooms(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { skip, limit, populate } = call.request.params;
    const { user } = call.request.context;
    const rooms = await ChatRoom.getInstance()
      .findMany({ participants: user._id, deleted: false }, { skip, limit, populate })
      .catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));
    const roomsCount = await ChatRoom.getInstance()
      .countDocuments({ participants: user._id, deleted: false })
      .catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));
    return { rooms, count: roomsCount };
  }

  async getRoom(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, populate } = call.request.params;
    const { user } = call.request.context;
    const room = await ChatRoom.getInstance()
      .findOne({ _id: id, participants: user._id, deleted: false }, { populate })
      .catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));
    if (!room) {
      throw new ModuleError(errors.ROOM_NOT_FOUND_OR_NO_ACCESS);
    }
    return room;
  }

  async deleteMessage(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { messageId } = call.request.params;
    const { user } = call.request.context;
    await deleteChatMessage(this.grpcSdk, { messageId, userId: user._id });
    return 'Message deleted successfully';
  }

  async patchMessage(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { messageId, newMessage } = call.request.params;
    const { user } = call.request.context;
    await editChatMessage(this.grpcSdk, {
      messageId,
      userId: user._id,
      newMessage,
    });
    return 'Message updated successfully';
  }

  async connect(call: ParsedSocketRequest): Promise<UnparsedSocketResponse> {
    const { user } = call.request.context;
    const rooms = await ChatRoom.getInstance().findMany(
      { participants: user._id, deleted: false },
      { select: '_id' },
    );
    return { event: 'join-room', rooms: rooms.map((room: ChatRoom) => room._id) };
  }

  async connectToRoom(call: ParsedSocketRequest): Promise<UnparsedSocketResponse> {
    const { user } = call.request.context;
    const [roomId] = call.request.params;
    const rooms = await ChatRoom.getInstance().findMany({
      _id: roomId,
      participants: user._id,
      deleted: false,
    });
    if (!rooms || rooms.length === 0) {
      throw new ModuleError(errors.ROOM_NOT_FOUND_OR_NO_ACCESS);
    }
    return { event: 'join-room', rooms: rooms.map((room: ChatRoom) => room._id) };
  }

  async onMessage(call: ParsedSocketRequest): Promise<UnparsedSocketResponse> {
    const { user } = call.request.context;
    const [roomId, message] = call.request.params;
    if (!(await this.verifyRoomMembership(roomId as string, user._id))) {
      throw new ModuleError(errors.ROOM_NOT_FOUND_OR_NO_ACCESS);
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
        throw new ModuleError(errors.MESSAGE_CONTENT_TYPE_MISSING);
      }
      if (
        !['text', 'file', 'typing', 'multimedia', 'system'].includes(message.contentType)
      ) {
        throw new ModuleError(errors.INVALID_MESSAGE_TYPE);
      }
      if (
        [MessageType.File, MessageType.Multimedia].includes(message.contentType) &&
        !message.files
      ) {
        throw new ModuleError(errors.MESSAGE_FILES_REQUIRED);
      }
      if (
        [MessageType.File, MessageType.Multimedia].includes(message.contentType) &&
        !Array.isArray(message.files)
      ) {
        throw new ModuleError(errors.MESSAGE_FILES_INVALID);
      }
      if (
        [MessageType.Text, MessageType.Multimedia, MessageType.System].includes(
          message.contentType,
        ) &&
        !message.content
      ) {
        throw new ModuleError(errors.MESSAGE_CONTENT_REQUIRED);
      }
      if (Object.hasOwn(message, 'nonce')) {
        const n = (message as { nonce?: unknown }).nonce;
        if (typeof n !== 'string' || n.length === 0) {
          throw new ModuleError(errors.INVALID_MESSAGE_NONCE);
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
            error: errors.MESSAGE_NOT_SAVED.message,
            conduitCode: 'MESSAGE_NOT_SAVED',
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
    if (!(await this.verifyRoomMembership(roomId as string, user._id))) {
      throw new ModuleError(errors.ROOM_NOT_FOUND_OR_NO_ACCESS);
    }

    this.scheduleReadFlush(roomId as string, user._id);
    return {
      event: 'messagesRead',
      receivers: [],
      rooms: [roomId as string],
      data: { room: roomId as string, readBy: user._id },
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
        errors: [
          errors.USERS_REQUIRED,
          errors.USERS_NOT_FOUND,
          errors.USERS_ALREADY_INVITED,
          errors.INVITATION_DELIVERY_FAILED,
          errors.CHAT_DATABASE_ERROR,
        ],
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
        errors: [
          errors.USERS_REQUIRED,
          errors.ROOM_NOT_FOUND_OR_NO_ACCESS,
          errors.ROOM_NOT_FOUND,
          errors.USERS_NOT_FOUND,
          errors.USERS_ALREADY_IN_ROOM,
          errors.USERS_ALREADY_INVITED,
          errors.INVITATION_DELIVERY_FAILED,
          errors.CHAT_DATABASE_ERROR,
        ],
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
        errors: [
          errors.ROOM_NOT_FOUND_OR_NO_ACCESS,
          errors.ROOM_NOT_FOUND,
          errors.CHAT_DATABASE_ERROR,
        ],
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
        errors: [errors.ROOM_NOT_FOUND_OR_NO_ACCESS, errors.CHAT_DATABASE_ERROR],
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
        errors: [errors.CHAT_DATABASE_ERROR],
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
        errors: [errors.MESSAGE_NOT_FOUND, errors.CHAT_DATABASE_ERROR],
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
        errors: [
          errors.ROOM_NOT_FOUND_OR_NO_ACCESS,
          errors.ROOM_NOT_FOUND,
          errors.CHAT_DATABASE_ERROR,
        ],
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
          errors: [
            errors.MESSAGE_DELETE_DISABLED,
            errors.MESSAGE_NOT_FOUND,
            errors.CHAT_DATABASE_ERROR,
          ],
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
          errors: [
            errors.MESSAGE_EDIT_DISABLED,
            errors.MESSAGE_NOT_FOUND,
            errors.CHAT_DATABASE_ERROR,
          ],
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

  private async verifyRoomMembership(roomId: string, userId: string): Promise<boolean> {
    const cacheKey = getMembershipCacheKey(roomId);
    if (this.grpcSdk.state) {
      const cached = await this.grpcSdk.state.getKey(cacheKey);
      if (cached) {
        const participants: string[] = JSON.parse(cached);
        return participants.includes(userId);
      }
    }
    const room = await ChatRoom.getInstance().findOne({
      _id: roomId,
      deleted: false,
      participants: userId,
    });
    if (!room) return false;
    if (this.grpcSdk.state) {
      await this.grpcSdk.state.setKey(
        cacheKey,
        JSON.stringify(room.participants),
        MEMBERSHIP_CACHE_TTL_MS,
      );
    }
    return true;
  }

  private scheduleReadFlush(roomId: string, userId: string): void {
    let entry = this.pendingReads.get(roomId);
    if (!entry) {
      entry = {
        userIds: new Set(),
        timer: setTimeout(() => this.flushReads(roomId), 500),
      };
      this.pendingReads.set(roomId, entry);
    }
    entry.userIds.add(userId);
  }

  private flushReads(roomId: string): void {
    const entry = this.pendingReads.get(roomId);
    if (!entry) return;
    this.pendingReads.delete(roomId);
    const promises = [...entry.userIds].map(userId =>
      ChatMessage.getInstance().updateMany(
        { room: roomId, readBy: { $ne: userId } },
        { $push: { readBy: userId } },
      ),
    );
    Promise.all(promises).catch(e => {
      ConduitGrpcSdk.Logger.error(
        `Failed to flush read receipts for room ${roomId}: ${e.message}`,
      );
    });
  }

  private async fetchAndValidateRoomById(
    roomId: string,
    userId: string & User,
  ): Promise<ChatRoom> {
    const room = await ChatRoom.getInstance()
      .findOne({ _id: roomId })
      .catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));
    if (isNil(room) || !room.participants.includes(userId)) {
      throw new ModuleError(errors.ROOM_NOT_FOUND_OR_NO_ACCESS);
    }
    return room;
  }
}
