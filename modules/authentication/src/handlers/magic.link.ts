import { isNil } from 'lodash';
import { TokenType } from '../constants/TokenType';
import { v4 as uuid } from 'uuid';
import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  ConfigController,
  Email,
  GrpcError,
  ParsedRouterRequest,
  RoutingManager,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { Token, User } from '../models';
import { status } from '@grpc/grpc-js';
import { IAuthenticationStrategy } from '../interfaces/AuthenticationStrategy';
import { TokenProvider } from './tokenProvider';
import { MagicLinkTemplate as template } from '../templates';

export class MagicLinkHandlers implements IAuthenticationStrategy {
  private emailModule: Email;
  private initialized: boolean = false;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  async validate(): Promise<boolean> {
    const config = ConfigController.getInstance().config;
    if (config.magic_link.enabled && this.grpcSdk.isAvailable('email')) {
      this.emailModule = this.grpcSdk.emailProvider!;
      await this.registerTemplates();
      return (this.initialized = true);
    } else {
      return (this.initialized = false);
    }
  }

  async declareRoutes(routingManager: RoutingManager): Promise<void> {
    const config = ConfigController.getInstance().config;
    routingManager.route(
      {
        path: '/hook/magic-link',
        action: ConduitRouteActions.POST,
        description: `A webhook used to send a magic link to a user.`,
        bodyParams: {
          email: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition('MagicLinkSendResponse', 'String'),
      this.sendMagicLink.bind(this),
    );

    routingManager.route(
      {
        path: '/hook/magic-link/:verificationToken',
        action: ConduitRouteActions.GET,
        description: `A webhook used to verify a user who has received a magic link.`,
        urlParams: {
          verificationToken: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition('VerifyMagicLinkLoginResponse', {
        userId: ConduitString.Optional,
        accessToken: ConduitString.Optional,
        refreshToken: config.generateRefreshToken
          ? ConduitString.Required
          : ConduitString.Optional,
        message: ConduitString.Optional,
      }),
      this.verifyLogin.bind(this),
    );
  }

  async sendMagicLink(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { email } = call.request.params;
    const user: User | null = await User.getInstance().findOne({ email: email });
    if (isNil(user)) throw new GrpcError(status.NOT_FOUND, 'User not found');

    const token: Token = await Token.getInstance().create({
      type: TokenType.MAGIC_LINK,
      user: user._id,
      token: uuid(),
    });

    await this.sendMagicLinkMail(user, token);
    return 'token send';
  }

  private async sendMagicLinkMail(user: User, token: Token) {
    const serverConfig = await this.grpcSdk.config.get('router');
    const url = serverConfig.hostUrl;

    const result = { token, hostUrl: url };
    const link = `${result.hostUrl}/hook/authentication/magic-link/${result.token.token}`;
    await this.emailModule
      .sendEmail('MagicLink', {
        email: user.email,
        sender: 'no-reply',
        variables: {
          link,
        },
      })
      .catch(e => {
        ConduitGrpcSdk.Logger.error(e);
      });
    return 'Email send';
  }

  async verifyLogin(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { verificationToken } = call.request.params.verificationToken;
    const context = call.request.context;
    if (isNil(context))
      throw new GrpcError(status.UNAUTHENTICATED, 'No headers provided');

    const clientId = context.clientId;
    const config = ConfigController.getInstance().config;
    const redirectUri = config.magic_link.redirect_uri;
    const token: Token | null = await Token.getInstance().findOne({
      type: TokenType.MAGIC_LINK,
      token: verificationToken,
    });
    if (isNil(token)) {
      throw new GrpcError(status.NOT_FOUND, 'Magic link token does not exist');
    }
    const user: User | null = await User.getInstance().findOne({
      _id: token.user,
    });
    if (isNil(user)) throw new GrpcError(status.NOT_FOUND, 'User not found');

    await Token.getInstance()
      .deleteMany({ userId: token.user, type: TokenType.MAGIC_LINK })
      .catch(e => {
        ConduitGrpcSdk.Logger.error(e);
      });

    return TokenProvider.getInstance()!.provideUserTokens(
      {
        user,
        clientId,
        config,
      },
      redirectUri,
    );
  }

  private registerTemplates() {
    return this.emailModule.registerTemplate(template).catch(e => {
      ConduitGrpcSdk.Logger.error(e);
    });
  }
}
