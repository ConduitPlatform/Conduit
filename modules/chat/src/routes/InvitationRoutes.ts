import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitNumber,
  ConduitString,
  ConfigController,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { ChatRoom, InvitationToken } from '../models/index.js';
import { invalidateMembershipCache } from '../utils/membershipCache.js';
import {
  validateInvitationAnswer,
  assertInvitationReceiver,
  buildInvitationHookUrl,
  buildLoginRedirectUrl,
  isAlreadyMember,
  replaceRoomIdInUri,
  InvitationError,
} from '../utils/invitationHelpers.js';
import { isNil } from 'lodash-es';
import { status } from '@grpc/grpc-js';
import { Config } from '../config/index.js';

export class InvitationRoutes {
  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly routingManager: RoutingManager,
  ) {}

  declareRoutes() {
    this.routingManager.route(
      {
        path: '/hook/chat/invitations/:answer/:invitationToken',
        description: `A webhook used to respond to a chat room invitation
                      requiring the invitation token.`,
        action: ConduitRouteActions.GET,
        urlParams: {
          answer: ConduitString.Required,
          invitationToken: ConduitString.Required,
        },
        middlewares: ['authMiddleware?'],
        rateLimit: {
          maxRequests: 50,
          resetInterval: 3600,
        },
      },
      new ConduitRouteReturnDefinition('InvitationHookResponse', {
        result: ConduitString.Optional,
        redirect: ConduitString.Optional,
      }),
      this.answerInvitationFromHook.bind(this),
    );
    this.routingManager.route(
      {
        path: '/invitations/by-token/:answer/:invitationToken',
        action: ConduitRouteActions.GET,
        description: `Responds to a chat room invitation using the invitation token after authentication.`,
        urlParams: {
          answer: ConduitString.Required,
          invitationToken: ConduitString.Required,
        },
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('InvitationByTokenResponse', 'String'),
      this.answerInvitationByToken.bind(this),
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

    try {
      validateInvitationAnswer(answer);
    } catch (err) {
      if (err instanceof InvitationError) {
        throw new GrpcError(err.code, err.message);
      }
      throw err;
    }

    const invitationTokenDoc: InvitationToken | null =
      await InvitationToken.getInstance().findOne({
        _id: id,
      });
    if (isNil(invitationTokenDoc)) {
      throw new GrpcError(status.NOT_FOUND, 'Invitation not valid');
    }

    const receiver = invitationTokenDoc.receiver as string;
    this.ensureInvitationReceiver(user._id, receiver);

    const message = await this.processInvitationAnswer(
      invitationTokenDoc,
      answer,
      user._id,
    );
    return message;
  }

  async answerInvitationFromHook(
    call: ParsedRouterRequest,
  ): Promise<UnparsedRouterResponse> {
    const { invitationToken, answer } = call.request.params;
    const { user } = call.request.context;
    const config = ConfigController.getInstance().config;

    try {
      validateInvitationAnswer(answer);
    } catch (err) {
      if (err instanceof InvitationError) {
        throw new GrpcError(err.code, err.message);
      }
      throw err;
    }

    if (isNil(user)) {
      return this.redirectUnauthenticatedUser(answer, invitationToken, config);
    }

    const invitationTokenDoc: InvitationToken | null =
      await InvitationToken.getInstance().findOne({
        token: invitationToken,
      });
    if (isNil(invitationTokenDoc)) {
      throw new GrpcError(status.NOT_FOUND, 'Invitation not valid');
    }

    const receiver = invitationTokenDoc.receiver as string;
    this.ensureInvitationReceiver(user._id, receiver);

    const roomId = invitationTokenDoc.room as string;
    const message = await this.processInvitationAnswer(
      invitationTokenDoc,
      answer,
      user._id,
    );
    return this.redirectAfterAnswer(answer, roomId, config, message);
  }

  async answerInvitationByToken(
    call: ParsedRouterRequest,
  ): Promise<UnparsedRouterResponse> {
    const { invitationToken, answer } = call.request.params;
    const { user } = call.request.context;

    try {
      validateInvitationAnswer(answer);
    } catch (err) {
      if (err instanceof InvitationError) {
        throw new GrpcError(err.code, err.message);
      }
      throw err;
    }

    const invitationTokenDoc: InvitationToken | null =
      await InvitationToken.getInstance().findOne({
        token: invitationToken,
      });
    if (isNil(invitationTokenDoc)) {
      throw new GrpcError(status.NOT_FOUND, 'Invitation not valid');
    }

    const receiver = invitationTokenDoc.receiver as string;
    this.ensureInvitationReceiver(user._id, receiver);

    const message = await this.processInvitationAnswer(
      invitationTokenDoc,
      answer,
      user._id,
    );
    return message;
  }

  private async processInvitationAnswer(
    invitationTokenDoc: InvitationToken,
    answer: string,
    receiverId: string,
  ): Promise<string> {
    const roomId = invitationTokenDoc.room as string;
    const chatRoom = await ChatRoom.getInstance()
      .findOne({ _id: roomId })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    if (isNil(chatRoom)) {
      throw new GrpcError(status.NOT_FOUND, 'Chat room does not exist');
    }

    const receiver = invitationTokenDoc.receiver as string;
    const accepted = answer === 'accept';
    const participants = chatRoom.participants as string[];
    const alreadyMember = isAlreadyMember(participants, receiver);

    if (alreadyMember) {
      await InvitationToken.getInstance().deleteMany({
        $and: [{ room: roomId }, { receiver }],
      });
      return accepted ? 'Invitation accepted' : 'Invitation declined';
    }

    let message: string;
    if (accepted) {
      (chatRoom.participants as string[]).push(String(receiver));
      await ChatRoom.getInstance().findByIdAndUpdate(roomId, chatRoom);
      message = 'Invitation accepted';

      await invalidateMembershipCache(this.grpcSdk, roomId);

      this.grpcSdk.router?.socketPush({
        event: 'join-room',
        receivers: [receiverId],
        rooms: [chatRoom._id],
      });
      this.grpcSdk.router?.socketPush({
        event: 'room-joined',
        receivers: [receiverId],
        rooms: [],
        data: JSON.stringify({ room: chatRoom._id, roomName: chatRoom.name }),
      });
    } else {
      message = 'Invitation declined';
    }

    await InvitationToken.getInstance().deleteMany({
      $and: [{ room: roomId }, { receiver }],
    });
    return message;
  }

  private ensureInvitationReceiver(userId: unknown, receiver: unknown): void {
    try {
      assertInvitationReceiver(userId, receiver);
    } catch (err) {
      if (err instanceof InvitationError) {
        throw new GrpcError(err.code, err.message);
      }
      throw err;
    }
  }

  private async resolveInvitationHookUrl(
    answer: string,
    invitationToken: string,
  ): Promise<string> {
    const routerConfig = await this.grpcSdk.config.get('router');
    return buildInvitationHookUrl(
      routerConfig.hostUrl,
      answer as 'accept' | 'decline',
      invitationToken,
    );
  }

  private async redirectUnauthenticatedUser(
    answer: string,
    invitationToken: string,
    config: Config,
  ): Promise<UnparsedRouterResponse> {
    const loginUri = (config.explicit_room_joins.redirect.login_uri || '').replace(
      /\/$/,
      '',
    );
    const hookUrl = await this.resolveInvitationHookUrl(answer, invitationToken);
    try {
      const redirectUrl = buildLoginRedirectUrl(
        loginUri,
        answer,
        invitationToken,
        hookUrl,
      );
      return { redirect: redirectUrl };
    } catch (err) {
      if (err instanceof InvitationError) {
        throw new GrpcError(err.code, err.message);
      }
      throw err;
    }
  }

  private redirectAfterAnswer(
    answer: string,
    roomId: string,
    config: Config,
    fallbackMessage: string,
  ): UnparsedRouterResponse {
    const redirectTemplate =
      answer === 'accept'
        ? config.explicit_room_joins.redirect.accept_uri
        : config.explicit_room_joins.redirect.decline_uri;
    if (!redirectTemplate) {
      return { result: fallbackMessage };
    }
    return { redirect: replaceRoomIdInUri(redirectTemplate as string, roomId) };
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
        {
          select: 'room createdAt updatedAt sender',
          skip,
          limit,
          populate: 'sender',
        },
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
        {
          select: 'room createdAt updatedAt receiver',
          skip,
          limit,
          populate: 'receiver',
        },
      )
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    const count = invitations.length;
    return { invitations, count };
  }
}
