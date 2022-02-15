import ConduitGrpcSdk, {
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitSocket,
  ConduitString,
  constructRoute,
  constructSocket,
  GrpcServer,
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
  SocketRequest,
  SocketResponse,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { ChatRoom, ChatMessage } from '../models';
import { isArray, isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import { validateUsersInput } from '../utils';

export class ChatRoutes {

  constructor(readonly server: GrpcServer, private readonly grpcSdk: ConduitGrpcSdk) {}

  async createRoom(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { roomName, users } = call.request.params;
    const { user } = call.request.context;
    if (isNil(users) || !isArray(users) || users.length === 0) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'users array is required and cannot be empty');
    }
    try {
      await validateUsersInput(this.grpcSdk, users);
    } catch (e) { throw new GrpcError(status.INTERNAL, e.message); }

    const room = await ChatRoom.getInstance()
      .create({
        name: roomName,
        participants: Array.from(new Set([user._id, ...users])),
      })
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });

    this.grpcSdk.bus?.publish(
      'chat:create:ChatRoom',
      JSON.stringify({ name: roomName, participants: (room as ChatRoom).participants })
    );
    return { roomId: room._id };
  }

  async addUserToRoom(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { roomId, users } = call.request.params;
    const { user } = call.request.context;
    if (isNil(roomId) || isNil(users) || !isArray(users) || users.length === 0) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'roomId and users array are required');
    }

    const room = await ChatRoom.getInstance()
      .findOne({ _id: roomId })
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });

    if (isNil(room) || !(room as ChatRoom).participants.includes(user._id)) {
      throw new GrpcError(status.NOT_FOUND, 'Room does not exist or you don\'t have access');
    }

    try {
      await validateUsersInput(this.grpcSdk, users);
    } catch (e) { throw new GrpcError(status.INTERNAL, e.message); }

    (room as ChatRoom).participants = Array.from(new Set([...(room as ChatRoom).participants, ...users]));
    await ChatRoom.getInstance()
      .findByIdAndUpdate(
        (room as ChatRoom)._id,
        { room }
      )
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });

    this.grpcSdk.bus?.publish('chat:addParticipant:ChatRoom', JSON.stringify(room));
    return 'User added successfully';
  }

  async leaveRoom(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { roomId } = call.request.params;
    const { user } = call.request.context;
    if (isNil(roomId)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'roomId is required');
    }

    const room = await ChatRoom.getInstance()
      .findOne({ _id: roomId })
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });

    if (isNil(room) || !(room as ChatRoom).participants.includes(user._id)) {
      throw new GrpcError(status.NOT_FOUND, 'Room does not exist or you don\'t have access');
    }

    const index = (room as ChatRoom).participants.indexOf(user._id);
    if (index > -1) {
      room.participants.splice(index, 1);
      await ChatRoom.getInstance()
        .findByIdAndUpdate(
          (room as ChatRoom)._id,
          room,
        )
        .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
    }

    this.grpcSdk.bus?.publish(
      'chat:leaveRoom:ChatRoom',
      JSON.stringify({ roomId, user: user._id })
    );

    return 'Ok';
  }

  async getMessages(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { roomId, skip, limit } = call.request.params;
    const { user } = call.request.context;
    let messagesPromise;
    let countPromise;
    if (isNil(roomId)) {
      const rooms = await ChatRoom.getInstance()
        .findMany({ participants: user._id })
        .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
      const query = { room: { $in: (rooms as ChatRoom[]).map((room: any) => room._id) } };
      messagesPromise = ChatMessage.getInstance()
        .findMany(
          query,
          undefined,
          skip,
          limit,
          { createdAt: -1 }
        );
      countPromise = ChatMessage.getInstance().countDocuments(query);
    } else {
      const room = await ChatRoom.getInstance()
        .findOne({ _id: roomId })
        .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
      if (isNil(room) || !(room as ChatRoom).participants.includes(user._id)) {
        throw new GrpcError(status.NOT_FOUND, 'Room does not exist or you don\'t have access');
      }
      messagesPromise = ChatMessage.getInstance()
        .findMany(
          {
            room: roomId,
          },
          undefined,
          skip,
          limit,
          { createdAt: -1 }
        )
        .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
      countPromise = ChatMessage.getInstance().countDocuments({ room: roomId });
    }

    const [messages, count] = await Promise.all([messagesPromise, countPromise])
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
    return { messages, count };
  }

  async getMessage(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id } = call.request.params;
    const { user } = call.request.context;
    const message = await ChatMessage.getInstance()
      .findOne(
        { _id: id },
        undefined,
        ['room']
      )
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
    if (
      !message ||
      (message.room as ChatRoom).participants.indexOf(user._id) === -1
    ) {
      throw new GrpcError(status.NOT_FOUND, 'Message does not exist or you don\'t have access');
    }
    return message;
  }

  async getRooms(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { skip, limit, populate } = call.request.params;
    const { user } = call.request.context;
    const rooms = await ChatRoom.getInstance()
        .findMany(
          { participants: user._id },
          undefined,
          skip,
          limit,
          undefined,
          populate
        )
        .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
    const roomsCount = await ChatRoom.getInstance()
      .countDocuments({ participants: user._id })
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
    return { rooms, count: roomsCount };
  }

  async getRoom(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, populate } = call.request.params;
    const { user } = call.request.context;
    const room = await ChatRoom.getInstance()
        .findOne(
          { _id: id, participants: user._id },
          undefined,
          populate
        )
        .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
    if (!room) {
      throw new GrpcError(status.NOT_FOUND, 'Room does not exist or you don\'t have access');
    }
    return room;
  }

  async deleteMessage(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { messageId } = call.request.params;
    const { user } = call.request.context;
    const message = await ChatMessage.getInstance()
      .findOne({ _id: messageId })
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
    if (isNil(message) || (message as ChatMessage).senderUser !== user._id) {
      throw new GrpcError(status.NOT_FOUND, 'Message does not exist or you don\'t have access');
    }
    await ChatMessage.getInstance()
      .deleteOne({ _id: messageId })
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
    this.grpcSdk.bus?.publish('chat:delete:ChatMessage', JSON.stringify(messageId));
    return 'Message deleted successfully';
  }

  async patchMessage(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { messageId, newMessage } = call.request.params;
    const { user } = call.request.context;
    const message = await ChatMessage.getInstance()
      .findOne({ _id: messageId })
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
    if (isNil(message) || (message as ChatMessage).senderUser !== user._id) {
      throw new GrpcError(status.NOT_FOUND, 'Message does not exist or you don\'t have access');
    }
    message.message = newMessage;
    await ChatMessage.getInstance()
      .findByIdAndUpdate(
        (message as ChatMessage)._id,
        { message }
      )
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
    this.grpcSdk.bus?.publish(
      'chat:edit:ChatMessage',
      JSON.stringify({ id: messageId, newMessage: message })
    );
    return 'Message updated successfully';
  }

  async connect(call: SocketRequest, callback: SocketResponse) {
    const { user } = JSON.parse(call.request.context);
    const rooms = await ChatRoom.getInstance()
      .findMany({ participants: user._id })
      .catch((e: Error) => {
        return callback({ code: status.INTERNAL, message: e.message });
      });
    callback(null, { rooms: (rooms as ChatRoom[]).map((room: any) => room._id) });
  }

  async onMessage(call: SocketRequest, callback: SocketResponse) {
    const { user } = JSON.parse(call.request.context);
    const [roomId, message] = JSON.parse(call.request.params);
    const room = await ChatRoom.getInstance()
      .findOne({ _id: roomId })
      .catch((e: Error) => {
        return callback({ code: status.INTERNAL, message: e.message });
      });

    if (isNil(room) || !(room as ChatRoom).participants.includes(user._id)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Room does not exist or you don\'t have access'
      });
    }

    ChatMessage.getInstance()
      .create({
        message,
        senderUser: user._id,
        room: roomId,
        readBy: [user._id],
      })
      .then(() => {
        callback(null, {
          event: 'message',
          receivers: [roomId],
          data: JSON.stringify({ sender: user._id, message, room: roomId }),
        });
      })
      .catch((e: Error) => {
        callback({
          code: status.INTERNAL,
          message: e.message,
        });
      });
  }

  async onMessagesRead(call: SocketRequest, callback: SocketResponse) {
    const { user } = JSON.parse(call.request.context);
    const [roomId] = JSON.parse(call.request.params);
    const room = await ChatRoom.getInstance()
      .findOne({ _id: roomId })
      .catch((e: Error) => {
        return callback({ code: status.INTERNAL, message: e.message });
      });
    if (isNil(room) || !(room as ChatRoom).participants.includes(user._id)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Room does not exist or you don\'t have access'
      });
    }

    const filterQuery = {
      room: (room as ChatRoom)._id,
      readBy: { $ne: user._id },
    };

    ChatMessage.getInstance()
      .updateMany(filterQuery, { $push: { readBy: user._id } })
      .then(() => {
        callback(null, {
          event: 'messagesRead',
          receivers: [(room as ChatRoom)._id],
          data: JSON.stringify({ room: (room as ChatRoom)._id, readBy: user._id }),
        });
      })
      .catch((e: Error) => {
        callback({
          code: status.INTERNAL,
          message: e.message,
        });
      });
  }

  async registerRoutes() {
    const activeRoutes = await this.getRegisteredRoutes();

    this.grpcSdk.router
      .registerRouterAsync(this.server, activeRoutes, {
        connect: this.connect.bind(this),
        createRoom: this.createRoom.bind(this),
        addUserToRoom: this.addUserToRoom.bind(this),
        leaveRoom: this.leaveRoom.bind(this),
        getMessages: this.getMessages.bind(this),
        getMessage: this.getMessage.bind(this),
        getRooms: this.getRooms.bind(this),
        getRoom: this.getRoom.bind(this),
        deleteMessage: this.deleteMessage.bind(this),
        patchMessage: this.patchMessage.bind(this),
        onMessage: this.onMessage.bind(this),
        onMessagesRead: this.onMessagesRead.bind(this),
      })
      .catch((err: Error) => {
        console.log('Failed to register routes for module');
        console.log(err);
      });
  }

  private async getRegisteredRoutes(): Promise<any[]> {
    let routesArray: any[] = [];

    routesArray.push(
      constructRoute(
        new ConduitRoute(
          {
            path: '/new',
            action: ConduitRouteActions.POST,
            bodyParams: {
              roomName: TYPE.String,
              users: [TYPE.String],
            },
            middlewares: ['authMiddleware'],
          },
          new ConduitRouteReturnDefinition('CreateRoom', {
            roomId: TYPE.String,
          }),
          'createRoom'
        )
      )
    );

    routesArray.push(
      constructRoute(
        new ConduitRoute(
          {
            path: '/add/:roomId',
            action: ConduitRouteActions.UPDATE,
            urlParams: {
              roomId: TYPE.String,
            },
            bodyParams: {
              users: [TYPE.String],
            },
            middlewares: ['authMiddleware'],
          },
          new ConduitRouteReturnDefinition('AddUserToRoomResponse', 'String'),
          'addUserToRoom'
        )
      )
    );

    routesArray.push(
      constructRoute(
        new ConduitRoute(
          {
            path: '/leave/:roomId',
            action: ConduitRouteActions.UPDATE,
            urlParams: {
              roomId: TYPE.String,
            },
            middlewares: ['authMiddleware'],
          },
          new ConduitRouteReturnDefinition('LeaveRoom', 'String'),
          'leaveRoom'
        )
      )
    );

    routesArray.push(
      constructRoute(
        new ConduitRoute(
          {
            urlParams: {
              id: ConduitString.Required,
            },
            path: '/rooms/:id',
            action: ConduitRouteActions.GET,
            middlewares: ['authMiddleware'],
          },
          new ConduitRouteReturnDefinition('ChatRoom', ChatRoom.getInstance().fields),
          'getRoom'
        )
      )
    );
    routesArray.push(
      constructRoute(
        new ConduitRoute(
          {
            path: '/rooms',
            queryParams: {
              skip: TYPE.Number,
              limit: TYPE.Number,
            },
            action: ConduitRouteActions.GET,
            middlewares: ['authMiddleware'],
          },
          new ConduitRouteReturnDefinition('ChatRoomsResponse', {
            rooms: ['ChatRoom'],
            count: TYPE.Number,
          }),
          'getRooms'
        )
      )
    );

    routesArray.push(
      constructRoute(
        new ConduitRoute(
          {
            urlParams: {
              id: ConduitString.Required,
            },
            path: '/messages/:id',
            action: ConduitRouteActions.GET,
            middlewares: ['authMiddleware'],
          },
          new ConduitRouteReturnDefinition('ChatMessage', ChatMessage.getInstance().fields),
          'getMessage'
        )
      )
    );

    routesArray.push(
      constructRoute(
        new ConduitRoute(
          {
            path: '/messages',
            action: ConduitRouteActions.GET,
            queryParams: {
              roomId: TYPE.String,
              skip: TYPE.Number,
              limit: TYPE.Number,
            },
            middlewares: ['authMiddleware'],
          },
          new ConduitRouteReturnDefinition('ChatMessagesResponse', {
            messages: ['ChatMessage'],
            count: TYPE.Number,
          }),
          'getMessages'
        )
      )
    );

    const config = await this.grpcSdk.config.get('chat');
    if (config.allowMessageDelete) {
      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: '/messages/:messageId',
              action: ConduitRouteActions.DELETE,
              urlParams: {
                messageId: TYPE.String,
              },
              middlewares: ['authMiddleware'],
            },
            new ConduitRouteReturnDefinition('DeleteMessageResponse', 'String'),
            'deleteMessage'
          )
        )
      );
    }

    if (config.allowMessageEdit) {
      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: '/messages/:messageId',
              action: ConduitRouteActions.UPDATE,
              urlParams: {
                messageId: TYPE.String,
              },
              bodyParams: {
                newMessage: TYPE.String,
              },
              middlewares: ['authMiddleware'],
            },
            new ConduitRouteReturnDefinition('PatchMessageResponse', 'String'),
            'patchMessage'
          )
        )
      );
    }

    routesArray.push(
      constructSocket(
        new ConduitSocket(
          {
            path: '/',
            middlewares: ['authMiddleware'],
          },
          {
            connect: {
              handler: 'connect',
            },
            message: {
              handler: 'onMessage',
              params: [TYPE.String, TYPE.String],
              returnType: new ConduitRouteReturnDefinition('MessageResponse', {
                sender: TYPE.String,
                message: TYPE.String,
                room: TYPE.String,
              }),
            },
            messagesRead: {
              handler: 'onMessagesRead',
              params: [TYPE.String],
              returnType: new ConduitRouteReturnDefinition('MessagesReadResponse', {
                room: TYPE.String,
                readBy: TYPE.String,
              }),
            },
          }
        )
      )
    );

    return routesArray;
  }
}
