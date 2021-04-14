import ConduitGrpcSdk, {
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitSocket,
  constructRoute,
  constructSocket,
  GrpcServer,
  RouterRequest,
  RouterResponse,
  SocketRequest,
  SocketResponse,
  TYPE,
} from '@quintessential-sft/conduit-grpc-sdk';
import { isArray, isNil } from 'lodash';
import * as grpc from 'grpc';

export class ChatRoutes {
  private database: any;

  constructor(readonly server: GrpcServer, private readonly grpcSdk: ConduitGrpcSdk) {
    const self = this;
    grpcSdk.waitForExistence('database-provider').then(() => {
      self.database = this.grpcSdk.databaseProvider;
    });
  }

  async createRoom(call: RouterRequest, callback: RouterResponse) {
    const { roomName, users } = JSON.parse(call.request.params);
    const { user } = JSON.parse(call.request.context);

    if (isNil(users) || !isArray(users) || users.length === 0) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'users array is required and cannot be empty'});
    }

    let errorMessage: string | null = null;
    const room = await this.database.create('ChatRoom', { name: roomName, participants: [user._id, ...users] })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    callback(null, { result: JSON.stringify({ roomId: room._id })});
  }

  async joinRoom(call: RouterRequest, callback: RouterResponse) {
    const { roomId } = JSON.parse(call.request.params);
    const { user } = JSON.parse(call.request.context);

    if (isNil(roomId)) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'roomId is required' });
    }

    let errorMessage: string | null = null;
    const room = await this.database.findOne('ChatRoom', { _id: roomId })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    if (isNil(room)) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'Room does not exist' });
    }

    room.participants.push(user._id);
    await this.database.findByIdAndUpdate('ChatRoom', room._id, room)
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    const messages = await this.database.findMany(
      'ChatMessage',
      { room: room._id },
      undefined,
      undefined,
      10,
      '-createdAt'
    )
    .catch((e: Error) => {
      errorMessage = e.message;
    });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    callback(null, { result: JSON.stringify({ messages }) });
  }

  async getMessages(call: RouterRequest, callback: RouterResponse) {
    const { room, skip, limit } = JSON.parse(call.request.params);
    const { user } = JSON.parse(call.request.context);

    let messagesPromise;
    let countPromise;
    if (isNil(room)) {
      let errorMessage: string | null = null;
      const rooms = await this.database.findMany('ChatRoom', { participants: user._id })
        .catch((e: Error) => (errorMessage = e.message));
      if (!isNil(errorMessage)) {
        return callback({ code: grpc.status.INTERNAL, message: errorMessage });
      }

      const query = { room: { $in: rooms.map((room: any) => room._id) }};
      messagesPromise = this.database.findMany('ChatMessage', query, undefined, skip, limit, '-createdAt');
      countPromise = this.database.countDocuments('ChatMessage', query);
    } else {
      messagesPromise = this.database.findMany(
        'ChatMessage',
        {
          room
        },
        undefined,
        skip,
        limit,
        '-createdAt'
      );

      countPromise = this.database.countDocuments('ChatMessage', { room });
    }

    Promise.all([messagesPromise, countPromise])
      .then((res) => {
        callback(null, { result: JSON.stringify({ messages: res[0], count: res[1] }) });
      })
      .catch((e: Error) => {
        callback({
          code: grpc.status.INTERNAL,
          message: e.message
        });
      });
  }

  async connect(call: SocketRequest, callback: SocketResponse) {
    const { user } = JSON.parse(call.request.context);

    let errorMessage: string | null = null;
    const rooms = await this.database.findMany('ChatRoom', { participants: user._id })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    callback(null, { rooms: rooms?.map((room: any) => room._id) });
  }

  async onMessage(call: SocketRequest, callback: SocketResponse) {
    const { user } = JSON.parse(call.request.context);
    const [ roomId, message ] = JSON.parse(call.request.params);

    let errorMessage: string | null = null;
    const room = await this.database.findOne('ChatRoom', { _id: roomId })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    if (isNil(room) || !room.participants.includes(user._id)) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'invalid room' });
    }

    this.database.create('ChatMessage', {
      message,
      senderUser: user._id,
      room: roomId
    }).then(() => {
      callback(null, {
        event: 'message',
        receivers: [roomId],
        data: JSON.stringify({ sender: user._id, message, room: roomId })
      });
    }).catch((e: Error) => {
      callback({
        code: grpc.status.INTERNAL,
        message: e.message
      });
    });
  }

  async registerRoutes() {
    const activeRoutes = await this.getRegisteredRoutes();

    this.grpcSdk.router
      .registerRouter(this.server, activeRoutes, {
        connect: this.connect.bind(this),
        createRoom: this.createRoom.bind(this),
        joinRoom: this.joinRoom.bind(this),
        getMessages: this.getMessages.bind(this),
        onMessage: this.onMessage.bind(this),
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
              users: [TYPE.String]
            },
            middlewares: ['authMiddleware'],
          },
          new ConduitRouteReturnDefinition('CreateRoom', {
            roomId: TYPE.String
          }),
          'createRoom'
        )
      )
    );

    routesArray.push(
      constructRoute(
        new ConduitRoute(
          {
            path: '/join/:roomId',
            action: ConduitRouteActions.POST,
            urlParams: {
              roomId: TYPE.String,
            },
            middlewares: ['authMiddleware'],
          },
          new ConduitRouteReturnDefinition('JoinRoom', {
            messages: [{
              _id: TYPE.String,
              senderUser: TYPE.String,
              room: TYPE.String,
              createdAt: TYPE.Date,
              updatedAt: TYPE.Date,
            }]
          }),
          'joinRoom',
        ),
      ),
    );

    routesArray.push(
      constructRoute(
        new ConduitRoute(
          {
            path: '/messages',
            action: ConduitRouteActions.GET,
            queryParams: {
              room: TYPE.String,
              skip: TYPE.Number,
              limit: TYPE.Number,
            },
            middlewares: ['authMiddleware']
          },
          new ConduitRouteReturnDefinition('MessagesResponse', {
            messages: [{
              _id: TYPE.String,
              message: TYPE.String,
              senderUser: TYPE.String,
              room: TYPE.String,
              createdAt: TYPE.Date,
              updatedAt: TYPE.Date,
            }],
            count: TYPE.Number
          }),
          'getMessages'
        )
      )
    );

    routesArray.push(
      constructSocket(
        new ConduitSocket(
          {
            path: '/',
            middlewares: ['authMiddleware'],
          },
          {
            'connect': {
              handler: 'connect',
            },
            'message': {
              handler: 'onMessage',
              params: [TYPE.String, TYPE.String],
              returnType: new ConduitRouteReturnDefinition('MessageResponse', {
                sender: TYPE.String,
                message: TYPE.String,
                room: TYPE.String
              })
            }
          },
        ),
      ),
    );

    return routesArray;
  }
}
