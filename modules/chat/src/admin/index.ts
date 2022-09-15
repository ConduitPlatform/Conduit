import ConduitGrpcSdk, {
  GrpcServer,
  constructConduitRoute,
  ParsedRouterRequest,
  UnparsedRouterResponse,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
  ConduitString,
  ConduitNumber,
  TYPE,
  ConduitRouteObject,
  Query,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash';
import { populateArray } from '../utils';
import { ChatRoom, ChatMessage, User } from '../models';

const escapeStringRegexp = require('escape-string-regexp');

export class AdminHandlers {
  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
  ) {
    this.registerAdminRoutes();
  }

  private registerAdminRoutes() {
    const paths = this.getRegisteredRoutes();
    this.grpcSdk.admin
      .registerAdminAsync(this.server, paths, {
        getRooms: this.getRooms.bind(this),
        createRoom: this.createRoom.bind(this),
        deleteRooms: this.deleteRooms.bind(this),
        getMessages: this.getMessages.bind(this),
        deleteMessages: this.deleteMessages.bind(this),
      })
      .catch((err: Error) => {
        ConduitGrpcSdk.Logger.error('Failed to register admin routes for module!');
        ConduitGrpcSdk.Logger.error(err);
      });
  }

  private getRegisteredRoutes(): ConduitRouteObject[] {
    return [
      constructConduitRoute(
        {
          path: '/rooms',
          action: ConduitRouteActions.GET,
          queryParams: {
            skip: ConduitNumber.Optional,
            limit: ConduitNumber.Optional,
            sort: ConduitString.Optional,
            search: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition('GetRooms', {
          chatRoomDocuments: [ChatRoom.name],
          count: ConduitNumber.Required,
        }),
        'getRooms',
      ),
      constructConduitRoute(
        {
          path: '/rooms',
          action: ConduitRouteActions.POST,
          bodyParams: {
            name: ConduitString.Required,
            participants: { type: [TYPE.String], required: true }, // handler array check is still required
          },
        },
        new ConduitRouteReturnDefinition(ChatRoom.name),
        'createRoom',
      ),
      constructConduitRoute(
        {
          path: '/rooms',
          action: ConduitRouteActions.DELETE,
          queryParams: {
            ids: { type: [TYPE.String], required: true },
          },
        },
        new ConduitRouteReturnDefinition('DeleteRooms', 'String'),
        'deleteRooms',
      ),
      constructConduitRoute(
        {
          path: '/messages',
          action: ConduitRouteActions.GET,
          queryParams: {
            skip: ConduitNumber.Optional,
            limit: ConduitNumber.Optional,
            sort: ConduitString.Optional,
            senderUser: ConduitString.Optional,
            roomId: ConduitString.Optional,
            search: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition('GetMessages', {
          messages: [ChatMessage.name],
          count: ConduitNumber.Required,
        }),
        'getMessages',
      ),
      constructConduitRoute(
        {
          path: '/messages',
          action: ConduitRouteActions.DELETE,
          queryParams: {
            ids: { type: [TYPE.String], required: true }, // handler array check is still required
          },
        },
        new ConduitRouteReturnDefinition('DeleteMessages', 'String'),
        'deleteMessages',
      ),
    ];
  }

  private async validateUsersInput(users: User[]) {
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

  async getRooms(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { sort, search, populate } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    let query: Query = {},
      populates;
    let identifier;
    if (!isNil(populate)) {
      populates = populateArray(populate);
    }
    if (!isNil(search)) {
      identifier = escapeStringRegexp(search);
      query['name'] = { $regex: `.*${identifier}.*`, $options: 'i' };
    }

    const chatRoomDocumentsPromise = ChatRoom.getInstance().findMany(
      query,
      undefined,
      skip,
      limit,
      sort,
      populates,
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
    const { participants } = call.request.params;
    if (participants.length === 0) {
      // array check is required
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'participants is required and must be a non-empty array',
      );
    }
    await this.validateUsersInput(participants);
    const chatRoom = await ChatRoom.getInstance()
      .create({
        name: call.request.params.name,
        participants: Array.from(new Set([...participants])),
      })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
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

  async getMessages(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { senderUser, roomId, populate, sort } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    const query: Query = {};
    let populates;
    if (!isNil(populate)) {
      populates = populateArray(populate);
    }
    if (!isNil(senderUser)) {
      query['senderUser'] = senderUser;
      const user = await User.getInstance().findOne({ _id: senderUser });
      if (isNil(user)) {
        throw new GrpcError(status.NOT_FOUND, `User ${senderUser} does not exist`);
      }
    }
    if (!isNil(roomId)) {
      query['room'] = roomId;
      const room = await ChatRoom.getInstance().findOne({ _id: roomId });
      if (isNil(room)) {
        throw new GrpcError(status.NOT_FOUND, `Room ${roomId} does not exists`);
      }
    }

    const messagesPromise = ChatMessage.getInstance().findMany(
      query,
      undefined,
      skip,
      limit,
      sort,
      populates,
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
}
