import ConduitGrpcSdk, {
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitSocket,
  ConduitString,
  constructRoute,
  constructSocket,
  GrpcServer,
  RouterRequest,
  RouterResponse,
  SocketRequest,
  SocketResponse,
  TYPE,
} from '@quintessential-sft/conduit-grpc-sdk';
import { ChatRoom, ChatMessage } from '../models';
import { isArray, isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import { validateUsersInput } from '../utils';

export class ChatRoutes {

  constructor(readonly server: GrpcServer, private readonly grpcSdk: ConduitGrpcSdk) {}

  async createRoom(call: RouterRequest, callback: RouterResponse) {
    const { roomName, users } = JSON.parse(call.request.params);
    const { user } = JSON.parse(call.request.context);

    if (isNil(users) || !isArray(users) || users.length === 0) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'users array is required and cannot be empty',
      });
    }

    try {
      await validateUsersInput(this.grpcSdk, users);
    } catch (e) {
      return callback({ code: e.code, message: e.message });
    }

    let errorMessage: string | null = null;
    const room = await ChatRoom.getInstance()
      .create({
        name: roomName,
        participants: Array.from(new Set([user._id, ...users])),
      })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    this.grpcSdk.bus?.publish(
      'chat:create:ChatRoom',
      JSON.stringify({ name: roomName, participants: (room as ChatRoom).participants })
    );
    callback(null, { result: JSON.stringify({ roomId: (room as ChatRoom)._id }) });
  }

  async addUserToRoom(call: RouterRequest, callback: RouterResponse) {
    const { roomId, users } = JSON.parse(call.request.params);
    const { user } = JSON.parse(call.request.context);

    if (isNil(roomId) || isNil(users) || !isArray(users) || users.length === 0) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'roomId and users array are required',
      });
    }

    let errorMessage: string | null = null;
    const room = await ChatRoom.getInstance()
      .findOne({ _id: roomId })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    if (isNil(room) || !(room as ChatRoom).participants.includes(user._id)) {
      return callback({ code: status.INVALID_ARGUMENT, message: 'Room does not exist' });
    }

    try {
      await validateUsersInput(this.grpcSdk, users);
    } catch (e) {
      return callback({ code: e.code, message: e.message });
    }

    (room as ChatRoom).participants = Array.from(new Set([...(room as ChatRoom).participants, ...users]));
    await ChatRoom.getInstance()
      .findByIdAndUpdate(
        (room as ChatRoom)._id,
        { room }
      )
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    this.grpcSdk.bus?.publish('chat:addParticipant:ChatRoom', JSON.stringify(room));

    callback(null, { result: 'users added successfully' });
  }

  async leaveRoom(call: RouterRequest, callback: RouterResponse) {
    const { roomId } = JSON.parse(call.request.params);
    const { user } = JSON.parse(call.request.context);

    if (isNil(roomId)) {
      return callback({ code: status.INVALID_ARGUMENT, message: 'roomId is required' });
    }

    let errorMessage: string | null = null;
    const room = await ChatRoom.getInstance()
      .findOne({ _id: roomId })
      .catch((e: Error) => {
        errorMessage = e.message;
      }) as ChatRoom;
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    if (isNil(room)) {
      return callback({ code: status.INVALID_ARGUMENT, message: 'Room does not exist' });
    }

    const index = (room as ChatRoom).participants.indexOf(user._id);
    if (index > -1) {
      room.participants = room.participants.splice(index, 1);
      await ChatRoom.getInstance()
        .findByIdAndUpdate(
          (room as ChatRoom)._id,
          room,
        )
        .catch((e: Error) => {
          errorMessage = e.message;
        });
      if (!isNil(errorMessage)) {
        return callback({ code: status.INTERNAL, message: errorMessage });
      }
    }

    this.grpcSdk.bus?.publish(
      'chat:leaveRoom:ChatRoom',
      JSON.stringify({ roomId, user: user._id })
    );

    callback(null, { result: 'ok' });
  }

  async getMessages(call: RouterRequest, callback: RouterResponse) {
    const { roomId, skip, limit } = JSON.parse(call.request.params);
    const { user } = JSON.parse(call.request.context);

    let messagesPromise;
    let countPromise;
    let errorMessage: string | null = null;
    if (isNil(roomId)) {
      const rooms = await ChatRoom.getInstance()
        .findMany({ participants: user._id })
        .catch((e: Error) => (errorMessage = e.message));
      if (!isNil(errorMessage)) {
        return callback({ code: status.INTERNAL, message: errorMessage });
      }
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
        .catch((e: Error) => (errorMessage = e.message));
      if (!isNil(errorMessage)) {
        return callback({ code: status.INTERNAL, message: errorMessage });
      }
      if (isNil(room) || !(room as ChatRoom).participants.includes(user._id)) {
        return callback({
          code: status.INVALID_ARGUMENT,
          message: 'room does not exist',
        });
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
        );
      countPromise = ChatMessage.getInstance().countDocuments({ room: roomId });
    }

    Promise.all([messagesPromise, countPromise])
      .then((res) => {
        callback(null, { result: JSON.stringify({ messages: res[0], count: res[1] }) });
      })
      .catch((e: Error) => {
        callback({
          code: status.INTERNAL,
          message: e.message,
        });
      });
  }

  async getMessage(call: RouterRequest, callback: RouterResponse) {
    const { id } = JSON.parse(call.request.params);
    const { user } = JSON.parse(call.request.context);
    try {
      let message = await ChatMessage.getInstance()
        .findOne(
          { _id: id },
          undefined,
          ['room']
        );
      if (!message) {
        return callback({ code: status.NOT_FOUND, message: 'Message not found!' });
      }
      if (message && (message.room as ChatRoom).participants.indexOf(user._id) === -1) {
        return callback({
          code: status.PERMISSION_DENIED,
          message: 'You do not have access to that message',
        });
      }

      callback(null, { result: JSON.stringify(message) });
    } catch (e) {
      return callback({
        code: status.INTERNAL,
        message: e.message ?? 'Something went wrong!',
      });
    }
  }

  async getRooms(call: RouterRequest, callback: RouterResponse) {
    const { skip, limit, populate } = JSON.parse(call.request.params);
    const { user } = JSON.parse(call.request.context);
    try {
      let rooms = await ChatRoom.getInstance()
        .findMany(
          { participants: user._id },
          undefined,
          skip,
          limit,
          undefined,
          populate
        );

      let roomsCount = await ChatRoom.getInstance().countDocuments({
        participants: user._id,
      });

      callback(null, { result: JSON.stringify({ rooms, count: roomsCount }) });
    } catch (e) {
      return callback({
        code: status.INTERNAL,
        message: e.message ?? 'Something went wrong!',
      });
    }
  }

  async getRoom(call: RouterRequest, callback: RouterResponse) {
    const { id, populate } = JSON.parse(call.request.params);
    const { user } = JSON.parse(call.request.context);
    try {
      let room = await ChatRoom.getInstance()
        .findOne(
          { _id: id, participants: user._id },
          undefined,
          populate
        );
      if (!room) {
        return callback({
          code: status.NOT_FOUND,
          message: "Room doesn't exist or you don't have access",
        });
      }

      callback(null, { result: JSON.stringify(room) });
    } catch (e) {
      return callback({
        code: status.INTERNAL,
        message: e.message ?? 'Something went wrong!',
      });
    }
  }

  async deleteMessage(call: RouterRequest, callback: RouterResponse) {
    const { messageId } = JSON.parse(call.request.params);
    const { user } = JSON.parse(call.request.context);

    let errorMessage: string | null = null;
    const message = await ChatMessage.getInstance()
      .findOne({ _id: messageId })
      .catch((e: Error) => {
        errorMessage = e.message;
      });

    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    if (isNil(message) || (message as ChatMessage).senderUser !== user._id) {
      return callback({ code: status.INVALID_ARGUMENT, message: 'invalid message id' });
    }

    ChatMessage.getInstance()
      .deleteOne({ _id: messageId })
      .then(() => {
        this.grpcSdk.bus?.publish('chat:delete:ChatMessage', JSON.stringify(messageId));
        callback(null, { result: 'message deleted successfully' });
      })
      .catch((e: Error) => {
        callback({ code: status.INTERNAL, message: e.message });
      });
  }

  async updateMessage(call: RouterRequest, callback: RouterResponse) {
    const { messageId, newMessage } = JSON.parse(call.request.params);
    const { user } = JSON.parse(call.request.context);

    let errorMessage: string | null = null;
    const message = await ChatMessage.getInstance()
      .findOne({ _id: messageId })
      .catch((e: Error) => {
        errorMessage = e.message;
      });

    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    if (isNil(message) || (message as ChatMessage).senderUser !== user._id) {
      return callback({ code: status.INVALID_ARGUMENT, message: 'invalid message id' });
    }

    (message as ChatMessage).message = newMessage;
    ChatMessage.getInstance()
      .findByIdAndUpdate(
        (message as ChatMessage)._id,
        { message }
      )
      .then(() => {
        this.grpcSdk.bus?.publish(
          'chat:edit:ChatMessage',
          JSON.stringify({ id: messageId, newMessage: message })
        );
        callback(null, { result: 'message changed successfully' });
      })
      .catch((e: Error) => {
        callback({ code: status.INTERNAL, message: e.message });
      });
  }

  async connect(call: SocketRequest, callback: SocketResponse) {
    const { user } = JSON.parse(call.request.context);
    let errorMessage: string | null = null;
    const rooms = await ChatRoom.getInstance()
      .findMany({ participants: user._id })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    callback(null, { rooms: (rooms as ChatRoom[]).map((room: any) => room._id) });
  }

  async onMessage(call: SocketRequest, callback: SocketResponse) {
    const { user } = JSON.parse(call.request.context);
    const [roomId, message] = JSON.parse(call.request.params);

    let errorMessage: string | null = null;
    const room = await ChatRoom.getInstance()
      .findOne({ _id: roomId })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    if (isNil(room) || !(room as ChatRoom).participants.includes(user._id)) {
      return callback({ code: status.INVALID_ARGUMENT, message: 'invalid room' });
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

    let errorMessage: string | null = null;
    const room = await ChatRoom.getInstance()
      .findOne({ _id: roomId })
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage)) {
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });
    }

    if (isNil(room) || !(room as ChatRoom).participants.includes(user._id)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'invalid room',
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
      .registerRouter(this.server, activeRoutes, {
        connect: this.connect.bind(this),
        createRoom: this.createRoom.bind(this),
        addUserToRoom: this.addUserToRoom.bind(this),
        leaveRoom: this.leaveRoom.bind(this),
        getMessages: this.getMessages.bind(this),
        getMessage: this.getMessage.bind(this),
        getRooms: this.getRooms.bind(this),
        getRoom: this.getRoom.bind(this),
        deleteMessage: this.deleteMessage.bind(this),
        updateMessage: this.updateMessage.bind(this),
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
          new ConduitRouteReturnDefinition('ChatRoom', {
            _id: TYPE.ObjectId,
            name: {
              type: TYPE.String,
              required: true,
            },
            participants: ['User'],
            createdAt: TYPE.Date,
            updatedAt: TYPE.Date,
          }),
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
          new ConduitRouteReturnDefinition('ChatMessage', {
            _id: TYPE.String,
            message: TYPE.String,
            senderUser: TYPE.String,
            room: TYPE.String,
            readBy: [TYPE.String],
            createdAt: TYPE.Date,
            updatedAt: TYPE.Date,
          }),
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
            new ConduitRouteReturnDefinition('UpdateMessageResponse', 'String'),
            'updateMessage'
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
