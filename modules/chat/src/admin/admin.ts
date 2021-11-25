import ConduitGrpcSdk, {
  GrpcServer,
  DatabaseProvider,
  constructConduitRoute,
  ParsedRouterRequest,
  UnparsedRouterResponse,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
  ConduitString,
  ConduitNumber,
  TYPE,
} from '@quintessential-sft/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash';
import { populateArray } from '../utils';
import { ChatRoom, ChatMessage, User } from '../models';

const escapeStringRegexp = require('escape-string-regexp');

export class AdminHandlers{
  private readonly database: DatabaseProvider;

  constructor(private readonly server: GrpcServer, private readonly  grpcSdk: ConduitGrpcSdk) {
    this.database = this.grpcSdk.databaseProvider!;
    User.getInstance(this.database);
    ChatRoom.getInstance(this.database);
    ChatMessage.getInstance(this.database);
    this.registerAdminRoutes();
  }

  private registerAdminRoutes() {
    const paths = this.getRegisteredRoutes();
    this.grpcSdk.admin
      .registerAdminAsync(this.server, paths, {
        getManyRooms: this.getManyRooms.bind(this),
        createRoom: this.createRoom.bind(this),
        deleteManyRooms: this.deleteManyRooms.bind(this),
        getManyMessages: this.getManyMessages.bind(this),
        // createMessage: this.createMessage.bind(this),
        deleteManyMessages: this.deleteManyMessages.bind(this)
      })
      .catch((err: Error) => {
        console.log('Failed to register admin routes for module!');
        console.error(err);
      });
  }

   private getRegisteredRoutes(): any[] {
     return [
       constructConduitRoute(
         {
           path: '/rooms',
           action: ConduitRouteActions.GET,
           queryParams: {
             skip: ConduitNumber.Optional,
             limit: ConduitNumber.Optional,
             search: ConduitString.Optional,
             populate: ConduitString.Optional,
           },
         },
         new ConduitRouteReturnDefinition('GetManyRooms', {
           chatRoomDocuments: [ChatRoom.getInstance().fields],
           totalCount: ConduitNumber.Required,
         }),
         'getManyRooms'
       ),
       constructConduitRoute(
         {
           path: '/room',
           action: ConduitRouteActions.POST,
           bodyParams: {
             name: ConduitString.Required,
             participants: { type: [TYPE.String], required: true }, // handler array check is still required
           },
         },
         new ConduitRouteReturnDefinition('CreateRoom', {
           room: ChatRoom.getInstance().fields,
         }),
         'createRoom'
       ),
       constructConduitRoute(
         {
           path: '/rooms',
           action: ConduitRouteActions.DELETE,
           bodyParams: {
             ids: { type: [TYPE.String], required: true },
           },
         },
         new ConduitRouteReturnDefinition('DeleteManyRooms', 'String'),
         'deleteManyRooms'
       ),
       constructConduitRoute(
         {
           path: '/messages',
           action: ConduitRouteActions.GET,
           queryParams: {
             skip: ConduitNumber.Optional,
             limit: ConduitNumber.Optional,
             senderUser: ConduitString.Optional,
             roomId: ConduitString.Optional,
             search: ConduitString.Optional,
             sort: ConduitString.Optional,
           },
         },
         new ConduitRouteReturnDefinition('GetManyMessages', {
           messages: [ChatMessage.getInstance().fields],
           count: ConduitNumber.Required,
         }),
         'getManyMessages'
       ),
       constructConduitRoute(
         {
           path: '/messages',
           action: ConduitRouteActions.DELETE,
           bodyParams: {
             ids: { type: [TYPE.String], required: true }, // handler array check is still required
           },
         },
         new ConduitRouteReturnDefinition('DeleteManyMessages', 'String'),
         'deleteManyMessages'
       ),
     ];
   }

  private async validateUsersInput(users: any[]) {
    const uniqueUsers = Array.from(new Set(users));
    const usersToBeAdded: void | User[] = await User.getInstance().findMany({ _id: { $in: uniqueUsers } })
    if (isNil(usersToBeAdded)) {
      throw new GrpcError(status.NOT_FOUND, 'Users do not exist');
    }
    if (usersToBeAdded.length !== uniqueUsers.length) {
      const dbUserIds = usersToBeAdded.map((user: any) => user._id);
      const wrongIds = uniqueUsers.filter((id) => !dbUserIds.includes(id));
      if (wrongIds.length !== 0) {
        throw new GrpcError(status.INVALID_ARGUMENT, `users [${wrongIds}] do not exist`);
      }
    }
  }

  async getManyRooms(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { skip, limit, search, populate } = call.request.params;
    let skipNumber = 0, limitNumber = 25;
    if (!isNil(skip)) {
      skipNumber = Number.parseInt(skip as string);
    }
    if (!isNil(limit)) {
      limitNumber = Number.parseInt(limit as string);
    }
    let query:any = {},populates;
    let identifier;
    if (!isNil(populate)) {
      populates = populateArray(populate);
    }
    if (!isNil(search)) {
      identifier = escapeStringRegexp(search);
      query['name'] =  { $regex: `.*${identifier}.*`, $options:'i'};
    }

    const chatRoomDocumentsPromise = ChatRoom.getInstance()
      .findMany(
        query,
        undefined,
        skipNumber,
        limitNumber,
        undefined,
        populates,
      );
    const totalCountPromise = ChatRoom.getInstance().countDocuments(query);

    const [chatRoomDocuments, totalCount] = await Promise.all([
      chatRoomDocumentsPromise,
      totalCountPromise,
    ]).catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });

    return { chatRoomDocuments, totalCount };
  }

  async createRoom(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { participants } = call.request.params;
    if (isNil(participants) || !Array.isArray(participants) || participants.length === 0) { // array check is required
      throw new GrpcError(status.INVALID_ARGUMENT, 'participants is required and must be a non-empty array');
    }
    await this.validateUsersInput(participants);
    const room = await ChatRoom.getInstance()
      .create({
        name: call.request.params.name,
        participants: Array.from(new Set([...participants])),
      })
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
    return { room };
  }

  async deleteManyRooms(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { ids } = call.request.params;
    if (isNil(ids) || !Array.isArray((ids)) || ids.length === 0) { // array check is required
      throw new GrpcError(status.INVALID_ARGUMENT, 'ids is required and must be a non-empty array');
    }
    await ChatRoom.getInstance()
      .deleteMany({ _id: { $in: ids } })
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
    await ChatMessage.getInstance()
      .deleteMany({ room: { $in: ids } })
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
    return 'Done';
  }

  async getManyMessages(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { skip, limit, senderUser, roomId, populate } = call.request.params;
    let skipNumber = 0, limitNumber = 25;
    if (!isNil(skip)) {
      skipNumber = Number.parseInt(skip as string);
    }
    if (!isNil(limit)) {
      limitNumber = Number.parseInt(limit as string);
    }
    let query:any = {};
    let populates;
    if (!isNil(populate)) {
      populates = populateArray(populate);
    }
    if (!isNil(senderUser)) {
      query['senderUser'] = senderUser;
      const user = await User.getInstance().findOne({ _id: senderUser })
      if (isNil(user)) {
        throw new GrpcError(status.NOT_FOUND, `User ${senderUser} does not exist`);
      }
    }
    if (!isNil(roomId)) {
      query['room'] =  roomId;
      const room = await ChatRoom.getInstance().findOne({ _id: roomId })
      if (isNil(room)) {
        throw new GrpcError(status.NOT_FOUND, `Room ${roomId} does not exists`);
      }
    }

    const messagesPromise = ChatMessage.getInstance()
    .findMany(
      query,
      undefined,
      skipNumber,
      limitNumber,
      undefined,
      populates,
    );
    const countPromise = ChatMessage.getInstance().countDocuments(query);
    const [messages, count] = await Promise.all([messagesPromise, countPromise])
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });

    return { messages, count };
  }

  // async createMessage(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
  //   // TODO: Implement createMessage handler
  //   return { message };
  // }

  async deleteManyMessages(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { ids } = call.request.params;
    if (isNil(ids) || !Array.isArray((ids)) || ids.length === 0) { // array check is required
      throw new GrpcError(status.INVALID_ARGUMENT, 'ids is required and must be a non-empty array');
    }
    await ChatMessage.getInstance()
      .deleteMany({ _id: { $in: ids } })
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
    return 'Done';
  }
}