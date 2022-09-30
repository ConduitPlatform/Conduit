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

export class MagicLinkHandlers implements IAuthenticationStrategy {
  private emailModule: Email;
  private initialized: boolean = false;
  private clientValidation: boolean;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    grpcSdk.config.get('router').then(config => {
      this.clientValidation = config.security.clientValidation;
    });
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
        description: `A webhook used to verify a user who has recieved a magic link.`,
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

  async validate(): Promise<boolean> {
    const config = ConfigController.getInstance().config;
    if (config.magic_link.enabled && this.grpcSdk.isAvailable('email')) {
      this.emailModule = this.grpcSdk.emailProvider!;
      return (this.initialized = true);
    } else {
      return (this.initialized = false);
    }
  }

  async sendMagicLink(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { email } = call.request.params;
    const user: User | null = await User.getInstance().findOne({ email: email });
    if (isNil(user)) throw new GrpcError(status.NOT_FOUND, 'User not found');

    const token: Token = await Token.getInstance().create({
      type: TokenType.PASSWORDLESS_LOGIN_TOKEN,
      userId: user._id,
      token: uuid(),
    });

    await this.sendMagicLinkMail(user, token);
    return 'token send';
  }

  private async sendMagicLinkMail(user: User, token: Token) {
    const serverConfig = await this.grpcSdk.config.get('router');
    const url = serverConfig.hostUrl;

    const result = { token, hostUrl: url };
    const link = `${result.hostUrl}/hook/authentication/passwordless-login/${result.token.token}`;
    await this.emailModule
      .sendEmail('PasswordlessLogin', {
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
      type: TokenType.PASSWORDLESS_LOGIN_TOKEN,
      token: verificationToken,
    });
    if (isNil(token)) {
      throw new GrpcError(status.NOT_FOUND, 'Passwordless login token does not exist');
    }
    const user: User | null = await User.getInstance().findOne({
      _id: token.user,
    });
    if (isNil(user)) throw new GrpcError(status.NOT_FOUND, 'User not found');

    await Token.getInstance()
      .deleteMany({ userId: token.user, type: TokenType.PASSWORDLESS_LOGIN_TOKEN })
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
}
