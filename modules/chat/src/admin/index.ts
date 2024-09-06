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
  ConduitNumber,
  ConduitObjectId,
  ConduitString,
  GrpcServer,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash-es';
import {
  ChatMessage,
  ChatParticipantsLog,
  ChatRoom,
  InvitationToken,
  User,
} from '../models/index.js';
import { Config } from '../config/index.js';

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
        action: 'join' as 'join',
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
