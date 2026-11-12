import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ParsedRouterRequest,
  Query,
  TYPE,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitBoolean,
  ConduitNumber,
  ConduitString,
  ConfigController,
  GrpcServer,
  ModuleError,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { errors } from '../errors.js';
import { isArray, isNil } from 'lodash-es';
import { populateArray } from '../utils/index.js';
import { invalidateMembershipCache } from '../utils/membershipCache.js';
import {
  ChatMessage,
  ChatParticipantsLog,
  ChatRoom,
  InvitationToken,
  User,
} from '../models/index.js';

import escapeStringRegexp from 'escape-string-regexp';

export class AdminHandlers {
  private readonly routingManager: RoutingManager;

  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
  ) {
    this.routingManager = new RoutingManager(this.grpcSdk.admin, this.server);
    this.registerAdminRoutes();
  }

  async getRoom(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, populate } = call.request.params;
    let populates;
    if (!isNil(populate)) {
      populates = populateArray(populate);
    }
    const room = await ChatRoom.getInstance()
      .findOne({ _id: id }, { populate: populates })
      .catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));
    if (!room) {
      throw new ModuleError(errors.ROOM_NOT_FOUND);
    }
    return room;
  }

  async getRooms(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { sort, search, populate, users, deleted } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    let query: Query<ChatRoom> = {};
    let identifier, populates;
    if (!isNil(populate)) {
      populates = populateArray(populate);
    }
    if (!isNil(search)) {
      identifier = escapeStringRegexp(search);
      query = { name: { $regex: `.*${identifier}.*`, $options: 'i' } };
    }
    if (!isNil(users) && isArray(users) && users.length > 0) {
      query = { ...query, participants: { $in: users } };
    }
    if (!isNil(deleted)) {
      query = { ...query, deleted };
    }

    const chatRoomDocumentsPromise = ChatRoom.getInstance().findMany(query, {
      skip,
      limit,
      sort,
      populate: populates,
    });
    const totalCountPromise = ChatRoom.getInstance().countDocuments(query);

    const [chatRoomDocuments, count] = await Promise.all([
      chatRoomDocumentsPromise,
      totalCountPromise,
    ]).catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));

    return { chatRoomDocuments, count };
  }

  async createRoom(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { name, creator } = call.request.params as {
      name: string;
      creator?: string;
      participants?: string[];
    };
    const participants = await this.validateUsersInput([
      ...(call.request.params.participants ?? []),
      creator,
    ]);
    const roomCreator =
      creator && participants.includes(creator) ? creator : participants[0];
    const chatRoom = await this.grpcSdk.database!.withOptionalTransaction(async db => {
      const createdRoom = await ChatRoom.getInstance()
        .create(
          {
            name,
            participants,
            creator: roomCreator,
          },
          { transaction: db },
        )
        .catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));
      const participantsLog = await ChatParticipantsLog.getInstance().createMany(
        [
          {
            user: roomCreator,
            action: 'create',
            chatRoom: createdRoom._id,
          },
          ...participants
            .filter(userId => userId !== roomCreator)
            .map(userId => ({
              user: userId,
              action: 'join',
              chatRoom: createdRoom._id,
            })),
        ],
        { transaction: db },
      );
      await ChatRoom.getInstance()
        .findByIdAndUpdate(
          createdRoom._id,
          { participantsLog: participantsLog.map(log => log._id) },
          { transaction: db },
        )
        .catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));
      return createdRoom;
    });
    this.grpcSdk.router?.socketPush({
      event: 'join-room',
      receivers: participants,
      rooms: [chatRoom._id],
    });
    this.grpcSdk.router?.socketPush({
      event: 'room-joined',
      receivers: participants,
      rooms: [],
      data: JSON.stringify({ room: chatRoom._id, roomName: chatRoom.name }),
    });
    this.grpcSdk.bus?.publish(
      'chat:create:ChatRoom',
      JSON.stringify({
        _id: chatRoom._id,
        name: chatRoom.name,
        participants: chatRoom.participants,
      }),
    );
    ConduitGrpcSdk.Metrics?.increment('chat_rooms_total');
    return chatRoom;
  }

  async deleteRooms(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { ids } = call.request.params;
    if (ids.length === 0) {
      // array check is required
      throw new ModuleError(errors.ROOM_IDS_REQUIRED);
    }

    const rooms = await ChatRoom.getInstance()
      .findMany({ _id: { $in: ids }, deleted: { $ne: true } })
      .catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));

    if (rooms.length === 0) return 'Done';

    const roomIds = rooms.map(r => r._id);
    const auditMode = ConfigController.getInstance().config.auditMode;

    if (auditMode) {
      for (const room of rooms) {
        const participantIds = room.participants.map(p =>
          typeof p === 'string' ? p : p._id,
        );
        // One transaction per room: the number of rooms is not bounded.
        await this.grpcSdk.database!.withOptionalTransaction(async db => {
          const participantsLog = await ChatParticipantsLog.getInstance()
            .createMany(
              participantIds.map(userId => ({
                user: userId,
                action: 'remove' as const,
                chatRoom: room._id,
              })),
              { transaction: db },
            )
            .catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));
          await ChatRoom.getInstance()
            .findByIdAndUpdate(
              room._id,
              {
                participantsLog: [
                  ...room.participantsLog.map(log =>
                    typeof log === 'string' ? log : log._id,
                  ),
                  ...participantsLog.map(log => log._id),
                ],
                deleted: true,
              },
              { transaction: db },
            )
            .catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));
        });
        // A room's history can be large, so it is marked outside the transaction.
        await ChatMessage.getInstance()
          .updateMany({ room: room._id }, { deleted: true })
          .catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));
      }
      await InvitationToken.getInstance()
        .deleteMany({ room: { $in: roomIds } })
        .catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));
    } else {
      await ChatRoom.getInstance()
        .deleteMany({ _id: { $in: roomIds } })
        .catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));
      await ChatMessage.getInstance()
        .deleteMany({ room: { $in: roomIds } })
        .catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));
      await InvitationToken.getInstance()
        .deleteMany({ room: { $in: roomIds } })
        .catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));
    }

    for (const room of rooms) {
      const roomId = room._id;
      const participantIds = room.participants.map(p =>
        typeof p === 'string' ? p : p._id,
      );

      await this.invalidateMembershipCache(roomId);
      this.grpcSdk.bus?.publish('chat:deleteRoom:ChatRoom', JSON.stringify({ roomId }));
      for (const userId of participantIds) {
        this.grpcSdk.router?.socketPush({
          event: 'leave-room',
          receivers: [userId],
          rooms: [roomId],
        });
        this.grpcSdk.bus?.publish(
          'chat:leaveRoom:ChatRoom',
          JSON.stringify({ roomId, user: userId }),
        );
      }
    }

    ConduitGrpcSdk.Metrics?.decrement('chat_rooms_total', rooms.length);
    return 'Done';
  }

  async addUsersToRoom(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { roomId, users } = call.request.params;
    const usersToAdd = await this.validateUsersInput(users ?? []);

    const room = await ChatRoom.getInstance()
      .findOne({ _id: roomId })
      .catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));
    if (isNil(room) || room.deleted) {
      throw new ModuleError(errors.ROOM_NOT_FOUND);
    }

    const participantIds = room.participants.map(p =>
      typeof p === 'string' ? p : p._id,
    );
    for (const userId of usersToAdd) {
      if (participantIds.includes(userId)) {
        throw new ModuleError(errors.USERS_ALREADY_IN_ROOM);
      }
    }

    const updatedRoom = await this.grpcSdk.database!.withOptionalTransaction(async db => {
      const participantsLog = await ChatParticipantsLog.getInstance().createMany(
        usersToAdd.map(userId => ({
          user: userId,
          action: 'add',
          chatRoom: room._id,
        })),
        { transaction: db },
      );
      return ChatRoom.getInstance()
        .findByIdAndUpdate(
          room._id,
          {
            participants: Array.from(new Set([...participantIds, ...usersToAdd])),
            participantsLog: [
              ...room.participantsLog.map(log =>
                typeof log === 'string' ? log : log._id,
              ),
              ...participantsLog.map(log => log._id),
            ],
          },
          { transaction: db },
        )
        .catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));
    });

    await this.invalidateMembershipCache(room._id);
    this.grpcSdk.router?.socketPush({
      event: 'join-room',
      receivers: usersToAdd,
      rooms: [room._id],
    });
    this.grpcSdk.router?.socketPush({
      event: 'room-joined',
      receivers: usersToAdd,
      rooms: [],
      data: JSON.stringify({ room: room._id, roomName: room.name }),
    });
    this.grpcSdk.bus?.publish(
      'chat:addParticipant:ChatRoom',
      JSON.stringify(updatedRoom ?? room),
    );
    return 'Users added';
  }

  async removeUsersFromRoom(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { roomId, users } = call.request.params;
    const usersToRemove = this.sanitizeUserIds(users ?? []);
    if (usersToRemove.length === 0) {
      throw new ModuleError(errors.USERS_REQUIRED);
    }

    const room = await ChatRoom.getInstance()
      .findOne({ _id: roomId })
      .catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));
    if (isNil(room) || room.deleted) {
      throw new ModuleError(errors.ROOM_NOT_FOUND);
    }

    const participantIds = room.participants.map(p =>
      typeof p === 'string' ? p : p._id,
    );
    const logIds = room.participantsLog.map(log =>
      typeof log === 'string' ? log : log._id,
    );
    const removedUsers: string[] = [];

    // One log entry per removed participant, so the loop is bounded by the room's size.
    const roomDeleted = await this.grpcSdk.database!.withOptionalTransaction(async db => {
      for (const userId of usersToRemove) {
        const index = participantIds.indexOf(userId);
        if (index === -1) {
          continue;
        }
        participantIds.splice(index, 1);
        const participantsLog = await ChatParticipantsLog.getInstance().create(
          {
            user: userId,
            action: 'remove',
            chatRoom: room._id,
          },
          { transaction: db },
        );
        logIds.push(participantsLog._id);
        removedUsers.push(userId);
      }

      if (removedUsers.length === 0) {
        throw new ModuleError(errors.USERS_NOT_IN_ROOM);
      }

      room.participants = participantIds;
      room.participantsLog = logIds;

      if (
        (room.participants.length === 1 &&
          ConfigController.getInstance().config.deleteEmptyRooms) ||
        room.participants.length === 0
      ) {
        if (ConfigController.getInstance().config.auditMode) {
          await ChatRoom.getInstance().findByIdAndUpdate(
            room._id,
            { ...room, deleted: true },
            { transaction: db },
          );
        } else {
          await ChatRoom.getInstance().deleteOne({ _id: room._id }, { transaction: db });
        }
        return true;
      }
      await ChatRoom.getInstance()
        .findByIdAndUpdate(room._id, room, { transaction: db })
        .catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));
      return false;
    });
    if (roomDeleted) {
      // A room's history can be large, so it is cleared outside the transaction.
      if (ConfigController.getInstance().config.auditMode) {
        await ChatMessage.getInstance().updateMany({ room: room._id }, { deleted: true });
      } else {
        await ChatMessage.getInstance().deleteMany({ room: room._id });
      }
      this.grpcSdk.bus?.publish('chat:deleteRoom:ChatRoom', JSON.stringify({ roomId }));
    }

    await this.invalidateMembershipCache(room._id);
    for (const userId of removedUsers) {
      this.grpcSdk.router?.socketPush({
        event: 'leave-room',
        receivers: [userId],
        rooms: [roomId],
      });
      this.grpcSdk.bus?.publish(
        'chat:leaveRoom:ChatRoom',
        JSON.stringify({ roomId, user: userId }),
      );
    }

    return 'Ok';
  }

  async getRoomInvitations(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { roomId, populate, sort } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;

    const room = await ChatRoom.getInstance().findOne({ _id: roomId });
    if (isNil(room)) {
      throw new ModuleError(errors.ROOM_NOT_FOUND, `Room ${roomId}`);
    }

    let populates;
    if (!isNil(populate)) {
      populates = populateArray(populate);
    }

    const invitationsPromise = InvitationToken.getInstance().findMany(
      { room: roomId },
      { skip, limit, sort, populate: populates },
    );
    const countPromise = InvitationToken.getInstance().countDocuments({ room: roomId });
    const [invitations, count] = await Promise.all([
      invitationsPromise,
      countPromise,
    ]).catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));

    return { invitations, count };
  }

  async deleteRoomInvitations(
    call: ParsedRouterRequest,
  ): Promise<UnparsedRouterResponse> {
    const { roomId, invitations } = call.request.params;
    if (isNil(invitations) || !isArray(invitations) || invitations.length === 0) {
      throw new ModuleError(errors.INVITATION_IDS_REQUIRED);
    }

    const room = await ChatRoom.getInstance().findOne({ _id: roomId });
    if (isNil(room)) {
      throw new ModuleError(errors.ROOM_NOT_FOUND, `Room ${roomId}`);
    }

    await InvitationToken.getInstance()
      .deleteMany({ _id: { $in: invitations }, room: roomId })
      .catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));
    return 'Done';
  }

  async getMessages(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { senderUser, roomId, populate, sort } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    const query: Query<ChatMessage> = {
      ...(senderUser ? { senderUser } : {}),
      ...(roomId ? { room: roomId } : {}),
    };
    let populates;
    if (!isNil(populate)) {
      populates = populateArray(populate);
    }
    if (!isNil(senderUser)) {
      const user = await User.getInstance().findOne({ _id: senderUser });
      if (isNil(user)) {
        throw new ModuleError(errors.SENDER_USER_NOT_FOUND, `User ${senderUser}`);
      }
    }
    if (!isNil(roomId)) {
      const room = await ChatRoom.getInstance().findOne({ _id: roomId });
      if (isNil(room)) {
        throw new ModuleError(errors.ROOM_NOT_FOUND, `Room ${roomId}`);
      }
    }

    const messagesPromise = ChatMessage.getInstance().findMany(query, {
      skip,
      limit,
      sort,
      populate: populates,
    });
    const countPromise = ChatMessage.getInstance().countDocuments(query);
    const [messages, count] = await Promise.all([messagesPromise, countPromise]).catch(
      ModuleError.rethrow(errors.CHAT_DATABASE_ERROR),
    );

    return { messages, count };
  }

  async deleteMessages(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { ids } = call.request.params;
    if (ids.length === 0) {
      // array check is required
      throw new ModuleError(errors.MESSAGE_IDS_REQUIRED);
    }
    await ChatMessage.getInstance()
      .deleteMany({ _id: { $in: ids } })
      .catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));
    return 'Done';
  }

  private registerAdminRoutes() {
    this.routingManager.clear();
    this.routingManager.route(
      {
        path: '/rooms/:id',
        action: ConduitRouteActions.GET,
        description: `Returns a chat room.`,
        urlParams: {
          id: ConduitString.Required,
        },
        queryParams: {
          populate: [ConduitString.Optional],
        },
        errors: [errors.ROOM_NOT_FOUND, errors.CHAT_DATABASE_ERROR],
      },
      new ConduitRouteReturnDefinition(ChatRoom.name),
      this.getRoom.bind(this),
    );
    this.routingManager.route(
      {
        path: '/rooms',
        action: ConduitRouteActions.GET,
        description: `Returns queried chat rooms.`,
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          sort: ConduitString.Optional,
          search: ConduitString.Optional,
          populate: [ConduitString.Optional],
          users: { type: [TYPE.String], required: false },
          deleted: ConduitBoolean.Optional,
        },
        errors: [errors.CHAT_DATABASE_ERROR],
      },
      new ConduitRouteReturnDefinition('GetRooms', {
        chatRoomDocuments: [ChatRoom.name],
        count: ConduitNumber.Required,
      }),
      this.getRooms.bind(this),
    );
    this.routingManager.route(
      {
        path: '/rooms',
        action: ConduitRouteActions.POST,
        description: `Creates a new chat room.`,
        bodyParams: {
          name: ConduitString.Required,
          participants: { type: [TYPE.String], required: true }, // handler array check is still required
          creator: ConduitString.Optional,
        },
        errors: [
          errors.USERS_REQUIRED,
          errors.USERS_NOT_FOUND,
          errors.CHAT_DATABASE_ERROR,
        ],
      },
      new ConduitRouteReturnDefinition(ChatRoom.name),
      this.createRoom.bind(this),
    );
    this.routingManager.route(
      {
        path: '/rooms',
        action: ConduitRouteActions.DELETE,
        description: `Deletes queried chat rooms.`,
        queryParams: {
          ids: { type: [TYPE.String], required: true },
        },
        errors: [errors.ROOM_IDS_REQUIRED, errors.CHAT_DATABASE_ERROR],
      },
      new ConduitRouteReturnDefinition('DeleteRooms', 'String'),
      this.deleteRooms.bind(this),
    );
    this.routingManager.route(
      {
        path: '/rooms/:roomId/add',
        action: ConduitRouteActions.UPDATE,
        description: `Adds users to a chat room.`,
        urlParams: {
          roomId: ConduitString.Required,
        },
        bodyParams: {
          users: { type: [TYPE.String], required: true },
        },
        errors: [
          errors.USERS_REQUIRED,
          errors.USERS_NOT_FOUND,
          errors.ROOM_NOT_FOUND,
          errors.USERS_ALREADY_IN_ROOM,
          errors.CHAT_DATABASE_ERROR,
        ],
      },
      new ConduitRouteReturnDefinition('AddUsersToRoomResponse', 'String'),
      this.addUsersToRoom.bind(this),
    );
    this.routingManager.route(
      {
        path: '/room/:roomId/remove',
        action: ConduitRouteActions.UPDATE,
        description: `Removes users from a chat room.`,
        urlParams: {
          roomId: ConduitString.Required,
        },
        bodyParams: {
          users: { type: [TYPE.String], required: true },
        },
        errors: [
          errors.USERS_REQUIRED,
          errors.ROOM_NOT_FOUND,
          errors.USERS_NOT_IN_ROOM,
          errors.CHAT_DATABASE_ERROR,
        ],
      },
      new ConduitRouteReturnDefinition('RemoveUsersFromRoomResponse', 'String'),
      this.removeUsersFromRoom.bind(this),
    );
    this.routingManager.route(
      {
        path: '/invitations/:roomId',
        action: ConduitRouteActions.GET,
        description: `Returns invitations for a chat room.`,
        urlParams: {
          roomId: ConduitString.Required,
        },
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          sort: ConduitString.Optional,
          populate: [ConduitString.Optional],
        },
        errors: [errors.ROOM_NOT_FOUND, errors.CHAT_DATABASE_ERROR],
      },
      new ConduitRouteReturnDefinition('GetRoomInvitations', {
        invitations: [InvitationToken.name],
        count: ConduitNumber.Required,
      }),
      this.getRoomInvitations.bind(this),
    );
    this.routingManager.route(
      {
        path: '/invitations/:roomId',
        action: ConduitRouteActions.DELETE,
        description: `Deletes invitations for a chat room.`,
        urlParams: {
          roomId: ConduitString.Required,
        },
        queryParams: {
          invitations: { type: [TYPE.String], required: true },
        },
        errors: [
          errors.INVITATION_IDS_REQUIRED,
          errors.ROOM_NOT_FOUND,
          errors.CHAT_DATABASE_ERROR,
        ],
      },
      new ConduitRouteReturnDefinition('DeleteRoomInvitations', 'String'),
      this.deleteRoomInvitations.bind(this),
    );
    this.routingManager.route(
      {
        path: '/messages',
        action: ConduitRouteActions.GET,
        description: `Returns queried messages.`,
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          sort: ConduitString.Optional,
          senderUser: ConduitString.Optional,
          roomId: ConduitString.Optional,
          search: ConduitString.Optional,
          populate: [ConduitString.Optional],
        },
        errors: [
          errors.SENDER_USER_NOT_FOUND,
          errors.ROOM_NOT_FOUND,
          errors.CHAT_DATABASE_ERROR,
        ],
      },
      new ConduitRouteReturnDefinition('GetMessages', {
        messages: [ChatMessage.name],
        count: ConduitNumber.Required,
      }),
      this.getMessages.bind(this),
    );
    this.routingManager.route(
      {
        path: '/messages',
        action: ConduitRouteActions.DELETE,
        description: `Deletes queried messages.`,
        queryParams: {
          ids: { type: [TYPE.String], required: true }, // handler array check is still required
        },
        errors: [errors.MESSAGE_IDS_REQUIRED, errors.CHAT_DATABASE_ERROR],
      },
      new ConduitRouteReturnDefinition('DeleteMessages', 'String'),
      this.deleteMessages.bind(this),
    );
    this.routingManager.registerRoutes();
  }

  private async invalidateMembershipCache(roomId: string): Promise<void> {
    await invalidateMembershipCache(this.grpcSdk, roomId);
  }

  private sanitizeUserIds(userIds: (string | undefined)[]): string[] {
    return Array.from(
      new Set(
        userIds.filter(
          (id): id is string => typeof id === 'string' && id.trim().length > 0,
        ),
      ),
    );
  }

  private async validateUsersInput(users: (string | undefined)[]): Promise<string[]> {
    const uniqueUsers = this.sanitizeUserIds(users);
    if (uniqueUsers.length === 0) {
      throw new ModuleError(errors.USERS_REQUIRED);
    }
    const usersToBeAdded: void | User[] = await User.getInstance().findMany({
      _id: { $in: uniqueUsers },
    });
    if (isNil(usersToBeAdded)) {
      throw new ModuleError(errors.USERS_NOT_FOUND);
    }
    if (usersToBeAdded.length !== uniqueUsers.length) {
      const dbUserIds = usersToBeAdded.map(user => user._id);
      const wrongIds = uniqueUsers.filter(id => !dbUserIds.includes(id));
      if (wrongIds.length !== 0) {
        throw new ModuleError({
          ...errors.USERS_NOT_FOUND,
          message: `users [${wrongIds}] do not exist`,
        });
      }
    }
    return uniqueUsers;
  }
}
