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
  ConduitObjectId,
  ConduitString,
  ConfigController,
  GrpcServer,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { isEmpty, isNil } from 'lodash-es';
import {
  ChatMessage,
  ChatParticipantsLog,
  ChatRoom,
  InvitationToken,
  User,
} from '../models/index.js';
import { Config } from '../config/index.js';

import escapeStringRegexp from 'escape-string-regexp';
import { sendInvitations } from '../utils/index.js';

export class AdminHandlers {
  private readonly routingManager: RoutingManager;

  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
  ) {
    this.routingManager = new RoutingManager(this.grpcSdk.admin, this.server);
    this.registerAdminRoutes();
  }

  async getRooms(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { sort, search, users, deleted, populate } = call.request.params as {
      sort?: string[];
      search?: string;
      users?: string[];
      deleted?: boolean;
      populate?: string[];
    };
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    let query: Query<ChatRoom> = {
      $and: [],
    };
    if (!isNil(search)) {
      query.$and?.push({
        name: { $regex: `.*${escapeStringRegexp(search)}.*`, $options: 'i' },
      });
    }
    if (!isNil(deleted)) {
      query.$and?.push({ deleted });
    }
    if (!isEmpty(users)) {
      query.$and?.push({ participants: { $in: users } });
    }
    if (!query.$and?.length) query = {};

    const chatRoomDocumentsPromise = ChatRoom.getInstance().findMany(
      query,
      undefined,
      skip,
      limit,
      sort,
      populate,
    );
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
    const { participants, creator } = call.request.params as {
      participants: string[];
      creator: string;
    };
    if (participants.length === 0) {
      // array check is required
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'participants is required and must be a non-empty array',
      );
    }
    await this.validateUsersInput(participants);
    const unique = new Set([...participants]);
    let chatRoom = await ChatRoom.getInstance()
      .create({
        name: call.request.params.name,
        participants: Array.from(unique),
        creator: creator,
      })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    const participantsLog = await ChatParticipantsLog.getInstance().createMany([
      {
        user: creator,
        action: 'create',
        chatRoom: chatRoom._id,
      },
      ...Array.from(unique).map((userId: string) => ({
        user: userId,
        action: 'join',
        chatRoom: chatRoom._id,
      })),
    ]);
    chatRoom = (await ChatRoom.getInstance().findByIdAndUpdate(chatRoom._id, {
      participantsLog: participantsLog.map(log => log._id),
    })) as ChatRoom;
    ConduitGrpcSdk.Metrics?.increment('chat_rooms_total');
    return chatRoom;
  }

  async deleteRooms(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { ids } = call.request.params as { ids: string[] };
    if (ids.length === 0) {
      // array check is required
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'ids is required and must be a non-empty array',
      );
    }
    const config = ConfigController.getInstance().config as Config;
    if (config.auditMode) {
      await Promise.all(
        ids.map(roomId => {
          ChatRoom.getInstance().findByIdAndUpdate(roomId, {
            deleted: true,
          });
          ChatMessage.getInstance().updateMany({ room: roomId }, { deleted: true });
        }),
      );
    } else {
      await ChatRoom.getInstance().deleteMany({ _id: { $in: ids } });
      await ChatMessage.getInstance().deleteMany({ room: { $in: ids } });
      await ChatParticipantsLog.getInstance().deleteMany({ chatRoom: { $in: ids } });
    }
    ConduitGrpcSdk.Metrics?.decrement('chat_rooms_total');
    return 'Done';
  }

  async getMessages(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { senderUser, roomId, populate, sort, search } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    const query: Query<ChatMessage> = {
      ...(senderUser ? { senderUser } : {}),
      ...(roomId ? { room: roomId } : {}),
    };
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
    if (!isNil(search)) {
      query.message = { $regex: search, $options: 'i' };
    }

    const messagesPromise = ChatMessage.getInstance().findMany(
      query,
      undefined,
      skip,
      limit,
      sort,
      populate,
    );
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

  async getRoomById(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { roomId } = call.request.urlParams as { roomId: string };
    const { populate } = call.request.queryParams as { populate: string[] };
    const room = await ChatRoom.getInstance().findOne(
      { _id: roomId },
      undefined,
      populate,
    );
    if (isNil(room)) throw new GrpcError(status.NOT_FOUND, 'Room does not exist');
    return room;
  }

  async getRoomInvitations(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { roomId } = call.request.urlParams as { roomId: string };
    const { skip, limit, sort, populate } = call.request.queryParams as {
      skip?: number;
      limit?: number;
      sort?: string;
      populate?: string[];
    };
    const invitations = await InvitationToken.getInstance()
      .findMany(
        { room: roomId },
        undefined,
        skip ?? 0,
        limit ?? 10,
        sort ?? '-createdAt',
        populate,
      )
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    const count = await InvitationToken.getInstance().countDocuments({
      room: roomId,
    });
    return { invitations, count };
  }

  async removeFromRoom(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { roomId } = call.request.urlParams as { roomId: string };
    const { users } = call.request.bodyParams as { users: string[] };
    if (!users.length) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'users field is required and must be a non-empty array',
      );
    }
    const room = await ChatRoom.getInstance().findOne({ _id: roomId });
    if (isNil(room) || room.deleted)
      throw new GrpcError(status.NOT_FOUND, "Room doesn't exists!");
    if (!room.participants.length)
      throw new GrpcError(status.CANCELLED, 'Room is already empty!');

    const unique = Array.from(new Set(users));
    const toBeRemoved = unique.flatMap(user => {
      const index = (room.participants as string[]).indexOf(user);
      if (index > -1) return user;
      else return [];
    });
    if (!toBeRemoved.length)
      throw new GrpcError(status.INVALID_ARGUMENT, 'Users are not participants of room!');

    room.participants = room.participants.flatMap(user => {
      const index = toBeRemoved.indexOf(user as string);
      if (index > -1) return [];
      else return user as string;
    });
    const participantsLog = await Promise.all(
      toBeRemoved.map(user =>
        ChatParticipantsLog.getInstance().create({
          user,
          action: 'remove',
          chatRoom: room._id,
        }),
      ),
    ).catch(e => {
      throw new GrpcError(status.INTERNAL, e.message);
    });
    room.participantsLog.push(...participantsLog);
    await ChatRoom.getInstance()
      .findByIdAndUpdate(room._id, room)
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

    const config = ConfigController.getInstance().config as Config;
    if (!room.participants.length && config.deleteEmptyRooms) {
      if (config.auditMode) {
        await ChatRoom.getInstance().findByIdAndUpdate(room._id, {
          deleted: true,
        });
        await ChatMessage.getInstance().updateMany({ room: room._id }, { deleted: true });
      } else {
        await ChatRoom.getInstance().deleteOne({ _id: roomId });
        await ChatMessage.getInstance().deleteMany({ room: room._id });
      }
    }
    return 'OK';
  }

  async addUserToRoom(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { roomId } = call.request.urlParams as { roomId: string };
    const { users } = call.request.bodyParams as { users: string[] };

    const room = await ChatRoom.getInstance().findOne({ _id: roomId }, undefined, [
      'creator',
    ]);
    if (isNil(room)) throw new GrpcError(status.NOT_FOUND, "Room doesn't exist");
    if (room.deleted) throw new GrpcError(status.NOT_FOUND, "Room doesn't exist");

    const unique = Array.from(new Set(users));
    const found = await User.getInstance().findMany({
      _id: { $in: unique },
    });
    if (found.length !== unique.length) {
      throw new GrpcError(status.INVALID_ARGUMENT, "User doesn't exist");
    }
    const toBeAdded = found.filter(
      user => !(room.participants as string[]).includes(user._id),
    );

    if (!toBeAdded.length)
      throw new GrpcError(status.INVALID_ARGUMENT, 'Users are already room members!');

    const config = ConfigController.getInstance().config as Config;
    if (config.explicit_room_joins.enabled) {
      const serverConfig = await this.grpcSdk.config.get('router');
      await sendInvitations({
        users: toBeAdded,
        sender: room.creator as User,
        room,
        url: serverConfig.hostUrl,
        sendEmail: config.explicit_room_joins.send_email,
        sendNotification: config.explicit_room_joins.send_notification,
        grpcSdk: this.grpcSdk,
      });
    } else {
      const participantsLog = await ChatParticipantsLog.getInstance().createMany(
        toBeAdded.map(user => ({
          user: user._id,
          action: 'added',
          chatRoom: room._id,
        })),
      );
      await ChatRoom.getInstance().findByIdAndUpdate(room._id, {
        participants: Array.from(
          new Set([
            ...(room.participants as string[]),
            ...toBeAdded.map(user => user._id),
          ]),
        ),
        participantsLog: [
          ...room.participantsLog,
          ...participantsLog.map(log => log._id),
        ],
      });
    }

    return 'OK';
  }

  private registerAdminRoutes() {
    this.routingManager.clear();
    this.routingManager.route(
      {
        path: '/rooms',
        action: ConduitRouteActions.GET,
        description: `Returns queried chat rooms.`,
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          sort: [ConduitString.Optional],
          search: ConduitString.Optional,
          users: [ConduitObjectId.Optional],
          deleted: ConduitBoolean.Optional,
          populate: [ConduitString.Optional],
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
          participants: [ConduitObjectId.Required], // handler array check is still required
          creator: ConduitObjectId.Required,
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
        path: '/messages',
        action: ConduitRouteActions.GET,
        description: `Returns queried messages.`,
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          sort: ConduitString.Optional,
          senderUser: ConduitObjectId.Optional,
          roomId: ConduitObjectId.Optional,
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
    this.routingManager.route(
      {
        path: '/rooms/:roomId',
        action: ConduitRouteActions.GET,
        description: `Returns room by id.`,
        urlParams: {
          roomId: ConduitObjectId.Required,
        },
        queryParams: {
          populate: [ConduitString.Optional],
        },
      },
      new ConduitRouteReturnDefinition('GetRoomById', ChatRoom.name),
      this.getRoomById.bind(this),
    );
    this.routingManager.route(
      {
        path: '/invitations/:roomId',
        action: ConduitRouteActions.GET,
        description: `Returns room invitations.`,
        urlParams: {
          roomId: ConduitObjectId.Required,
        },
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          sort: ConduitString.Optional,
          populate: [ConduitString.Optional],
        },
      },
      new ConduitRouteReturnDefinition('GetInvitationsResponse', {
        invitations: [InvitationToken.name],
        count: ConduitNumber.Required,
      }),
      this.getRoomInvitations.bind(this),
    );
    this.routingManager.route(
      {
        path: '/rooms/:roomId/add',
        action: ConduitRouteActions.UPDATE,
        description: 'Adds users to room',
        urlParams: {
          roomId: ConduitObjectId.Required,
        },
        bodyParams: {
          users: [ConduitObjectId.Required],
        },
      },
      new ConduitRouteReturnDefinition('RoomAddResponse', 'String'),
      this.addUserToRoom.bind(this),
    );
    this.routingManager.route(
      {
        path: '/room/:roomId/remove',
        action: ConduitRouteActions.UPDATE,
        description: 'Removes users from room',
        urlParams: {
          roomId: ConduitObjectId.Required,
        },
        bodyParams: {
          users: [ConduitObjectId.Required],
        },
      },
      new ConduitRouteReturnDefinition('RoomLeaveResponse', 'String'),
      this.removeFromRoom.bind(this),
    );
    this.routingManager.registerRoutes();
  }

  private async validateUsersInput(users: string[]) {
    const uniqueUsers = Array.from(new Set(users));
    const usersToBeAdded: void | User[] = await User.getInstance().findMany({
      _id: { $in: uniqueUsers },
    });
    if (isNil(usersToBeAdded)) {
      throw new GrpcError(status.NOT_FOUND, 'Users do not exist');
    }
    if (usersToBeAdded.length !== uniqueUsers.length) {
      const dbUserIds = usersToBeAdded.map((user: any) => user._id);
      const wrongIds = uniqueUsers.filter(id => !dbUserIds.includes(id));
      if (wrongIds.length !== 0) {
        throw new GrpcError(status.INVALID_ARGUMENT, `users [${wrongIds}] do not exist`);
      }
    }
  }
}
