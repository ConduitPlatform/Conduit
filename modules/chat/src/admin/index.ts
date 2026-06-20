import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
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
  RoutingManager,
} from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { isArray, isNil } from 'lodash-es';
import { populateArray } from '../utils/index.js';
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
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    if (!room) {
      throw new GrpcError(status.NOT_FOUND, 'Room does not exist');
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
    ]).catch((e: Error) => {
      throw new GrpcError(status.INTERNAL, e.message);
    });

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
    const chatRoom = await ChatRoom.getInstance()
      .create({
        name,
        participants,
        creator: roomCreator,
      })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    const participantsLog = await ChatParticipantsLog.getInstance().createMany([
      {
        user: roomCreator,
        action: 'create',
        chatRoom: chatRoom._id,
      },
      ...participants
        .filter(userId => userId !== roomCreator)
        .map(userId => ({
          user: userId,
          action: 'join',
          chatRoom: chatRoom._id,
        })),
    ]);
    await ChatRoom.getInstance()
      .findByIdAndUpdate(chatRoom._id, {
        participantsLog: participantsLog.map(log => log._id),
      })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
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
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'ids is required and must be a non-empty array',
      );
    }
    await ChatRoom.getInstance()
      .deleteMany({ _id: { $in: ids } })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    await ChatMessage.getInstance()
      .deleteMany({ room: { $in: ids } })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    ConduitGrpcSdk.Metrics?.decrement('chat_rooms_total');
    return 'Done';
  }

  async addUsersToRoom(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { roomId, users } = call.request.params;
    const usersToAdd = await this.validateUsersInput(users ?? []);

    const room = await ChatRoom.getInstance()
      .findOne({ _id: roomId })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    if (isNil(room) || room.deleted) {
      throw new GrpcError(status.NOT_FOUND, "Room doesn't exist");
    }

    const participantIds = room.participants.map(p =>
      typeof p === 'string' ? p : p._id,
    );
    for (const userId of usersToAdd) {
      if (participantIds.includes(userId)) {
        throw new GrpcError(
          status.ALREADY_EXISTS,
          'users array contains existing member ids',
        );
      }
    }

    const participantsLog = await ChatParticipantsLog.getInstance().createMany(
      usersToAdd.map(userId => ({
        user: userId,
        action: 'add',
        chatRoom: room._id,
      })),
    );
    const updatedRoom = await ChatRoom.getInstance()
      .findByIdAndUpdate(room._id, {
        participants: Array.from(new Set([...participantIds, ...usersToAdd])),
        participantsLog: [
          ...room.participantsLog.map(log => (typeof log === 'string' ? log : log._id)),
          ...participantsLog.map(log => log._id),
        ],
      })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
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
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'users is required and must be a non-empty array',
      );
    }

    const room = await ChatRoom.getInstance()
      .findOne({ _id: roomId })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    if (isNil(room) || room.deleted) {
      throw new GrpcError(status.NOT_FOUND, "Room doesn't exist");
    }

    const participantIds = room.participants.map(p =>
      typeof p === 'string' ? p : p._id,
    );
    const logIds = room.participantsLog.map(log =>
      typeof log === 'string' ? log : log._id,
    );
    const removedUsers: string[] = [];

    for (const userId of usersToRemove) {
      const index = participantIds.indexOf(userId);
      if (index === -1) {
        continue;
      }
      participantIds.splice(index, 1);
      const participantsLog = await ChatParticipantsLog.getInstance().create({
        user: userId,
        action: 'remove',
        chatRoom: room._id,
      });
      logIds.push(participantsLog._id);
      removedUsers.push(userId);
    }

    if (removedUsers.length === 0) {
      throw new GrpcError(
        status.NOT_FOUND,
        'None of the specified users are room participants',
      );
    }

    room.participants = participantIds;
    room.participantsLog = logIds;

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
        await ChatMessage.getInstance().updateMany({ room: room._id }, { deleted: true });
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
      throw new GrpcError(status.NOT_FOUND, `Room ${roomId} does not exist`);
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
    ]).catch((e: Error) => {
      throw new GrpcError(status.INTERNAL, e.message);
    });

    return { invitations, count };
  }

  async deleteRoomInvitations(
    call: ParsedRouterRequest,
  ): Promise<UnparsedRouterResponse> {
    const { roomId, invitations } = call.request.params;
    if (isNil(invitations) || !isArray(invitations) || invitations.length === 0) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'invitations is required and must be a non-empty array',
      );
    }

    const room = await ChatRoom.getInstance().findOne({ _id: roomId });
    if (isNil(room)) {
      throw new GrpcError(status.NOT_FOUND, `Room ${roomId} does not exist`);
    }

    await InvitationToken.getInstance()
      .deleteMany({ _id: { $in: invitations }, room: roomId })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
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
        throw new GrpcError(status.NOT_FOUND, `User ${senderUser} does not exist`);
      }
    }
    if (!isNil(roomId)) {
      const room = await ChatRoom.getInstance().findOne({ _id: roomId });
      if (isNil(room)) {
        throw new GrpcError(status.NOT_FOUND, `Room ${roomId} does not exists`);
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
      (e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      },
    );

    return { messages, count };
  }

  async deleteMessages(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { ids } = call.request.params;
    if (ids.length === 0) {
      // array check is required
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'ids is required and must be a non-empty array',
      );
    }
    await ChatMessage.getInstance()
      .deleteMany({ _id: { $in: ids } })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
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
      },
      new ConduitRouteReturnDefinition('DeleteMessages', 'String'),
      this.deleteMessages.bind(this),
    );
    this.routingManager.registerRoutes();
  }

  private async invalidateMembershipCache(roomId: string): Promise<void> {
    if (!this.grpcSdk.state) return;
    await this.grpcSdk.state.clearKey(`chat:membership:${roomId}`);
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
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'users is required and must be a non-empty array',
      );
    }
    const usersToBeAdded: void | User[] = await User.getInstance().findMany({
      _id: { $in: uniqueUsers },
    });
    if (isNil(usersToBeAdded)) {
      throw new GrpcError(status.NOT_FOUND, 'Users do not exist');
    }
    if (usersToBeAdded.length !== uniqueUsers.length) {
      const dbUserIds = usersToBeAdded.map(user => user._id);
      const wrongIds = uniqueUsers.filter(id => !dbUserIds.includes(id));
      if (wrongIds.length !== 0) {
        throw new GrpcError(status.INVALID_ARGUMENT, `users [${wrongIds}] do not exist`);
      }
    }
    return uniqueUsers;
  }
}
