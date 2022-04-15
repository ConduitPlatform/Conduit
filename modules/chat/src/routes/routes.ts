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
  UnparsedSocketResponse, Email,
} from '@conduitplatform/grpc-sdk';
import { ChatMessage, ChatRoom, InvitationToken, User } from '../models';
import { isArray, isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import { validateUsersInput } from '../utils';
import { v4 as uuid } from 'uuid';
import * as templates from '../templates';

export class ChatRoutes {

  private _routingManager: RoutingManager;

  constructor(readonly server: GrpcServer, private readonly grpcSdk: ConduitGrpcSdk, private readonly emailModule: Email) {
    this._routingManager = new RoutingManager(this.grpcSdk.router, server);

  }

  private registerTemplates() {
    this.grpcSdk.config
      .get('email')
      .then((emailConfig: any) => {
        const promises = Object.values(templates).map((template) => {
          return this.emailModule.registerTemplate(template);
        });
        return Promise.all(promises);
      })
      .then(() => {
        console.log('Email templates registered');
      })
      .catch((e: Error) => {
        console.error('Internal error while registering email templates');
      });
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
    const actualUser = User.getInstance().findOne({ _id: user._id });
    let usersToBeAdded;
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
      usersToBeAdded = await validateUsersInput(this.grpcSdk, users);
    } catch (e) {
      throw new GrpcError(status.INTERNAL, e.message);
    }

    const config = await this.grpcSdk.config.get('chat');
    if (config.sendInvitations.enabled) {
      const serverConfig = await this.grpcSdk.config.getServerConfig();
      const url = serverConfig.url;
      if (config.sendInvitations.send_email) {
        for (const invitedUser of usersToBeAdded) {
          let invitationToken: InvitationToken = await InvitationToken.getInstance().create({
            invited: invitedUser._id,
            invitor: user._id,
            token: uuid(),
            room: roomId,
          });
          let result = { invitationToken, hostUrl: url };
          const acceptLink = `${result.hostUrl}/hook/chat/accept/${result.invitationToken.token}`;
          const declineLink = `${result.hostUrl}/hook/chat/decline/${result.invitationToken.token}`;
          const roomName = room.name;
          const userName = user.email;
          await this.emailModule.sendEmail('ChatRoomInvitation', {
            email: invitedUser.email,
            sender: 'no-reply',
            variables: {
              acceptLink,
              declineLink,
              userName,
              roomName,
            },
          });
        }
      }
      return 'Invitations were sent successfully';
    } else {
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
    const [roomId, message] = call.request.params;
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
    const [roomId] = call.request.params;
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

  async answerInvitation(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { invitationToken, answer } = call.request.params;
    const invitationTokenDoc: InvitationToken | null = await InvitationToken.getInstance().findOne({
      token: invitationToken,
    });
    if (isNil(invitationTokenDoc)) {
      throw new GrpcError(status.NOT_FOUND, 'Invitation not valid');
    }
    const roomId: string = invitationTokenDoc?.room as string;
    const chatRoom = await ChatRoom.getInstance().findOne({ _id: roomId })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    if (isNil(chatRoom)) {
      throw new GrpcError(status.NOT_FOUND, 'Chat room does not exist');
    }
    const invited = invitationTokenDoc.invited as any;
    if (chatRoom.participants.indexOf(invited) !== -1) {
      throw new GrpcError(status.NOT_FOUND, `You already member of this chat room`);
    }
    const accepted = (answer === 'accept');
    let message;
    if (!isNil(invitationTokenDoc) && accepted) {
      chatRoom.participants.push(invited);
      await ChatRoom.getInstance().findByIdAndUpdate(
        roomId,
        chatRoom,
      );
      message = 'Invitation accepted';
    } else {
      message = 'Invitation declined';
    }
    const query = { $and: [{ room: roomId }, { invited: invited }] };
    await InvitationToken.getInstance().deleteMany(query);
    return message;
  }

  async cancelInvitation(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { room, invited } = call.request.params;
    const chatRoom = await ChatRoom.getInstance().findOne({ _id: room })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    if (isNil(chatRoom)) {
      throw new GrpcError(status.NOT_FOUND, 'Room not found');
    }

    const query = { $and: [{ invitor: user._id }, { room: room }, { invited: invited }] };
    const deleted = await InvitationToken.getInstance().deleteMany(query)
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    if (!deleted.deletedCount) {
      throw new GrpcError(status.NOT_FOUND, `You don't own invitations`);
    }
    return 'Invitation canceled successfully';
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
    if (config.sendInvitations.enabled) {
      // TODO Check if email is active
      this.registerTemplates();
      this._routingManager.route(
        {
          path: '/hook/:answer/:invitationToken',
          action: ConduitRouteActions.GET,
          urlParams: {
            answer: ConduitString.Required,
            invitationToken: ConduitString.Required,
          },
        },
        new ConduitRouteReturnDefinition('InvitationResponse', 'String'),
        this.answerInvitation.bind(this),
      );
      this._routingManager.route(
        {
          path: '/invitation/cancel',
          action: ConduitRouteActions.DELETE,
          urlParams: {
            room: ConduitString.Required,
            invited: ConduitString.Required,
          },
          middlewares: ['authMiddleware'],
        },
        new ConduitRouteReturnDefinition('InvitationCancelResponse', 'String'),
        this.cancelInvitation.bind(this),
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
