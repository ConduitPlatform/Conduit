import ConduitGrpcSdk, {
  ConduitNumber,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  GrpcError,
  ParsedRouterRequest,
  RoutingManager,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { ChatRoom, InvitationToken } from '../models';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';

export class InvitationRoutes {
  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly routingManager: RoutingManager,
  ) {}

  declareRoutes() {
    this.routingManager.route(
      {
        path: '/hook/invitations/:answer/:invitationToken',
        description: `A webhook used to respond to a chat room invitation
                      requiring the invitation token.`,
        action: ConduitRouteActions.GET,
        urlParams: {
          answer: ConduitString.Required,
          invitationToken: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition('InvitationResponse', 'String'),
      this.answerInvitationFromHook.bind(this),
    );
    this.routingManager.route(
      {
        path: '/invitations/:answer/:id',
        action: ConduitRouteActions.GET,
        description: `Responds to a chat room invitation requiring the invitation token id.`,
        urlParams: {
          id: ConduitString.Required,
          answer: ConduitString.Required,
        },
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('InvitationResponse', 'String'),
      this.answerInvitation.bind(this),
    );
    this.routingManager.route(
      {
        path: '/invitations/received',
        action: ConduitRouteActions.GET,
        description: `Returns current user's received invitations and their total count.`,
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
        },
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('GetInvitationsResponse', {
        invitations: [InvitationToken.name],
        count: ConduitNumber.Required,
      }),
      this.getInvitations.bind(this),
    );
    this.routingManager.route(
      {
        path: '/invitations/sent',
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
        },
        action: ConduitRouteActions.GET,
        description: `Returns queried invitations the current user has sent.`,
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('SentInvitationsResponse', {
        invitations: [InvitationToken.name],
        count: ConduitNumber.Required,
      }),
      this.sentInvitations.bind(this),
    );
    this.routingManager.route(
      {
        path: '/invitations/cancel/:id',
        action: ConduitRouteActions.DELETE,
        description: `Cancels an invitation the current user has sent.`,
        urlParams: {
          id: ConduitString.Required,
        },
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('InvitationCancelResponse', 'String'),
      this.cancelInvitation.bind(this),
    );
  }

  async answerInvitation(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, answer } = call.request.params;
    const { user } = call.request.context;
    const invitationTokenDoc: InvitationToken | null =
      await InvitationToken.getInstance().findOne({
        _id: id,
        receiver: user._id,
      });
    if (isNil(invitationTokenDoc)) {
      throw new GrpcError(status.NOT_FOUND, 'Invitation not valid');
    }
    let message;
    const receiver = user._id;
    const accepted = answer === 'accept';
    const chatRoom = await ChatRoom.getInstance().findOne({
      _id: invitationTokenDoc.room as string,
    });
    if (isNil(chatRoom)) {
      throw new GrpcError(status.NOT_FOUND, 'Chat room does not exist');
    }
    if (!isNil(invitationTokenDoc) && accepted) {
      chatRoom.participants.push(user);
      await ChatRoom.getInstance().findByIdAndUpdate(chatRoom._id, chatRoom);
      message = 'Invitation accepted';
    } else {
      message = 'Invitation declined';
    }

    const query = { $and: [{ room: chatRoom._id }, { receiver: receiver }] };
    await InvitationToken.getInstance().deleteMany(query);
    return message;
  }

  async answerInvitationFromHook(
    call: ParsedRouterRequest,
  ): Promise<UnparsedRouterResponse> {
    const { invitationToken, answer } = call.request.params;
    const { user } = call.request.context;
    const invitationTokenDoc: InvitationToken | null =
      await InvitationToken.getInstance().findOne({
        token: invitationToken,
        receiver: user._id,
      });
    if (isNil(invitationTokenDoc)) {
      throw new GrpcError(status.NOT_FOUND, 'Invitation not valid');
    }
    const roomId: string = invitationTokenDoc?.room as string;
    const chatRoom = await ChatRoom.getInstance()
      .findOne({ _id: roomId })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    if (isNil(chatRoom)) {
      throw new GrpcError(status.NOT_FOUND, 'Chat room does not exist');
    }
    const receiver = invitationTokenDoc.receiver;
    if ((chatRoom.participants as string[]).indexOf(receiver as string) !== -1) {
      throw new GrpcError(
        status.NOT_FOUND,
        `User is already a member of target chat room`,
      );
    }
    const accepted = answer === 'accept';
    let message;
    if (!isNil(invitationTokenDoc) && accepted) {
      (chatRoom.participants as string[]).push(receiver as string);
      await ChatRoom.getInstance().findByIdAndUpdate(roomId, chatRoom);
      message = 'Invitation accepted';
    } else {
      message = 'Invitation declined';
    }
    const query = { $and: [{ room: roomId }, { receiver: receiver }] };
    await InvitationToken.getInstance().deleteMany(query);
    return message;
  }

  async cancelInvitation(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { id } = call.request.params;
    const invitation = await InvitationToken.getInstance()
      .findOne({ _id: id })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    if (isNil(invitation)) {
      throw new GrpcError(status.NOT_FOUND, 'Room does not exist');
    }
    if (user._id === invitation.sender) {
      const deleted = await InvitationToken.getInstance()
        .deleteOne({ _id: id })
        .catch((e: Error) => {
          throw new GrpcError(status.INTERNAL, e.message);
        });
      if (!deleted.deletedCount) {
        throw new GrpcError(status.NOT_FOUND, `You don't own invitations`);
      }
    } else {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        `You can't cancel an invitation which is not sent by you`,
      );
    }
    return 'Invitation canceled successfully';
  }

  async getInvitations(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    const invitations = await InvitationToken.getInstance()
      .findMany(
        { receiver: user._id },
        'room createdAt updatedAt sender',
        skip,
        limit,
        undefined,
        'sender',
      )
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

    const count = invitations.length;
    return { invitations, count };
  }

  async sentInvitations(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    const invitations = await InvitationToken.getInstance()
      .findMany(
        { sender: user._id },
        'room createdAt updatedAt receiver',
        skip,
        limit,
        undefined,
        'receiver',
      )
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    const count = invitations.length;
    return { invitations, count };
  }
}
