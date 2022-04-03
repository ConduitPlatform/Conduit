import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  ConduitNumber,
  GrpcError,
  GrpcServer,
  ParsedRouterRequest,
  RoutingManager,
  TYPE,
  ParsedSocketRequest,
  UnparsedRouterResponse,
  UnparsedSocketResponse,
} from '@conduitplatform/grpc-sdk';
import { ChatMessage, ChatRoom } from '../models';
import { isArray, isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import { validateUsersInput } from '../utils';

export class ChatRoutes {

  private _routingManager: RoutingManager;

  constructor(readonly server: GrpcServer, private readonly grpcSdk: ConduitGrpcSdk) {
    this._routingManager = new RoutingManager(this.grpcSdk.router, server);

  }

  async createRoom(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { roomName, users } = call.request.params;
    const { user } = call.request.context;
    if (isNil(users) || !isArray(users) || users.length === 0) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'users is required and must be a non-empty array');
    }
    try {
      await validateUsersInput(this.grpcSdk, users);
    } catch (e) {
      throw new GrpcError(status.INTERNAL, e.message);
    }

    const room = await ChatRoom.getInstance()
      .create({
        name: roomName,
        participants: Array.from(new Set([user._id, ...users])),
      })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

    this.grpcSdk.bus?.publish(
      'chat:create:ChatRoom',
      JSON.stringify({ name: roomName, participants: room.participants }),
    );
    return { roomId: room._id };
  }

  async addUserToRoom(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { roomId, users } = call.request.params;
    const { user } = call.request.context;
    if (isNil(users) || !isArray(users) || users.length === 0) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'users is required and must be a non-empty array');
    }

    const room = await ChatRoom.getInstance()
      .findOne({ _id: roomId })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

    if (isNil(room) || !room.participants.includes(user._id)) {
      throw new GrpcError(status.NOT_FOUND, 'Room does not exist or you don\'t have access');
    }

    try {
      await validateUsersInput(this.grpcSdk, users);
    } catch (e) {
      throw new GrpcError(status.INTERNAL, e.message);
    }

    room.participants = Array.from(new Set([...room.participants, ...users]));
    await ChatRoom.getInstance()
      .findByIdAndUpdate(
        room._id,
        room,
      )
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

    this.grpcSdk.bus?.publish('chat:addParticipant:ChatRoom', JSON.stringify(room));
    return 'User added successfully';
  }

  async leaveRoom(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { roomId } = call.request.params;
    const { user } = call.request.context;

    const room = await ChatRoom.getInstance()
      .findOne({ _id: roomId })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

    if (isNil(room) || !room.participants.includes(user._id)) {
      throw new GrpcError(status.NOT_FOUND, 'Room does not exist or you don\'t have access');
    }

    const index = room.participants.indexOf(user._id);
    if (index > -1) {
      room.participants.splice(index, 1);
      await ChatRoom.getInstance()
        .findByIdAndUpdate(
          room._id,
          room,
        )
        .catch((e: Error) => {
          throw new GrpcError(status.INTERNAL, e.message);
        });
    }

    this.grpcSdk.bus?.publish(
      'chat:leaveRoom:ChatRoom',
      JSON.stringify({ roomId, user: user._id }),
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
        .catch((e: Error) => {
          throw new GrpcError(status.INTERNAL, e.message);
        });
      const query = { room: { $in: rooms.map((room: any) => room._id) } };
      messagesPromise = ChatMessage.getInstance()
        .findMany(
          query,
          undefined,
          skip,
          limit,
          { createdAt: -1 },
        );
      countPromise = ChatMessage.getInstance().countDocuments(query);
    } else {
      const room = await ChatRoom.getInstance()
        .findOne({ _id: roomId })
        .catch((e: Error) => {
          throw new GrpcError(status.INTERNAL, e.message);
        });
      if (isNil(room) || !room.participants.includes(user._id)) {
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
          { createdAt: -1 },
        )
        .catch((e: Error) => {
          throw new GrpcError(status.INTERNAL, e.message);
        });
      countPromise = ChatMessage.getInstance().countDocuments({ room: roomId });
    }

    const [messages, count] = await Promise.all([messagesPromise, countPromise])
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    return { messages, count };
  }

  async getMessage(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id } = call.request.params;
    const { user } = call.request.context;
    const message = await ChatMessage.getInstance()
      .findOne(
        { _id: id },
        undefined,
        ['room'],
      )
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
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
        populate,
      )
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    const roomsCount = await ChatRoom.getInstance()
      .countDocuments({ participants: user._id })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    return { rooms, count: roomsCount };
  }

  async getRoom(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, populate } = call.request.params;
    const { user } = call.request.context;
    const room = await ChatRoom.getInstance()
      .findOne(
        { _id: id, participants: user._id },
        undefined,
        populate,
      )
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
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
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    if (isNil(message) || message.senderUser !== user._id) {
      throw new GrpcError(status.NOT_FOUND, 'Message does not exist or you don\'t have access');
    }
    await ChatMessage.getInstance()
      .deleteOne({ _id: messageId })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    this.grpcSdk.bus?.publish('chat:delete:ChatMessage', JSON.stringify(messageId));
    return 'Message deleted successfully';
  }

  async patchMessage(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { messageId, newMessage } = call.request.params;
    const { user } = call.request.context;
    const message = await ChatMessage.getInstance()
      .findOne({ _id: messageId })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    if (isNil(message) || message.senderUser !== user._id) {
      throw new GrpcError(status.NOT_FOUND, 'Message does not exist or you don\'t have access');
    }
    message.message = newMessage;
    await ChatMessage.getInstance()
      .findByIdAndUpdate(
        message._id,
        { message },
      )
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
    const rooms = await ChatRoom.getInstance()
      .findMany({ participants: user._id });
    return { rooms: rooms.map((room: any) => room._id) };
  }

  async onMessage(call: ParsedSocketRequest): Promise<UnparsedSocketResponse> {
    const { user } = call.request.context;
    const [ roomId, message ] = call.request.params;
    const room = await ChatRoom.getInstance().findOne({ _id: roomId });

    if (isNil(room) || !room.participants.includes(user._id)) {
      throw new GrpcError(status.INVALID_ARGUMENT,
        'Room does not exist or you don\'t have access');
    }

    await ChatMessage.getInstance()
      .create({
        message,
        senderUser: user._id,
        room: roomId,
        readBy: [user._id],
      });
    return {
      event: 'message',
      receivers: [roomId],
      data: { sender: user._id, message, room: roomId },
    };
  }

  async onMessagesRead(call: ParsedSocketRequest): Promise<UnparsedSocketResponse> {
    const { user } = call.request.context;
    const [ roomId ] = call.request.params;
    const room = await ChatRoom.getInstance()
      .findOne({ _id: roomId });
    if (isNil(room) || !room.participants.includes(user._id)) {
      throw new GrpcError(status.INVALID_ARGUMENT,
        'Room does not exist or you don\'t have access');
    }

    const filterQuery = {
      room: room._id,
      readBy: { $ne: user._id },
    };

    await ChatMessage.getInstance()
      .updateMany(filterQuery, { $push: { readBy: user._id } });
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
        path: '/new',
        action: ConduitRouteActions.POST,
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
        path: '/add/:roomId',
        action: ConduitRouteActions.UPDATE,
        urlParams: {
          roomId: ConduitString.Required,
        },
        bodyParams: {
          users: [TYPE.String],
        },
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('AddUserToRoomResponse', 'String'),
      this.addUserToRoom.bind(this),
    );

    this._routingManager.route(
      {
        path: '/leave/:roomId',
        action: ConduitRouteActions.UPDATE,
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
        urlParams: {
          id: ConduitString.Required,
        },
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('ChatRoom', ChatRoom.getInstance().fields),
      this.getRoom.bind(this),
    );
    this._routingManager.route(
      {
        path: '/rooms',
        action: ConduitRouteActions.GET,
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
        },
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('ChatRoomsResponse', {
        rooms: ['ChatRoom'],
        count: ConduitNumber.Required,
      }),
      this.getRooms.bind(this),
    );

    this._routingManager.route(
      {
        path: '/messages/:id',
        action: ConduitRouteActions.GET,
        urlParams: {
          id: ConduitString.Required,
        },
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('ChatMessage', ChatMessage.getInstance().fields),
      this.getMessage.bind(this),
    );

    this._routingManager.route(
      {
        path: '/messages',
        action: ConduitRouteActions.GET,
        queryParams: {
          roomId: ConduitString.Optional,
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
        },
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('ChatMessagesResponse', {
        messages: ['ChatMessage'],
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
}
