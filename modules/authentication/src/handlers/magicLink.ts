import { isNil } from 'lodash';
import { TokenType } from '../constants';
import { v4 as uuid } from 'uuid';
import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  Email,
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';

import {
  ConduitString,
  ConfigController,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { Token, User } from '../models';
import { status } from '@grpc/grpc-js';
import { IAuthenticationStrategy } from '../interfaces';
import { TokenProvider } from './tokenProvider';
import { MagicLinkTemplate as magicLinkTemplate } from '../templates';

export class MagicLinkHandlers implements IAuthenticationStrategy {
  private emailModule: Email;
  private initialized: boolean = false;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  async validate(): Promise<boolean> {
    const config = ConfigController.getInstance().config;
    if (config.magic_link.enabled && this.grpcSdk.isAvailable('email')) {
      this.emailModule = this.grpcSdk.emailProvider!;
      const success = await this.registerTemplate()
        .then(() => true)
        .catch(e => {
          ConduitGrpcSdk.Logger.error(e);
          return false;
        });
      ConduitGrpcSdk.Logger.log(
        `Magic link authentication is ${success ? '' : 'not'} available`,
      );
      return (this.initialized = success);
    } else {
      ConduitGrpcSdk.Logger.log('Magic link authentication not available');
      return (this.initialized = false);
    }
  }

  async declareRoutes(routingManager: RoutingManager): Promise<void> {
    routingManager.route(
      {
        path: '/magic-link',
        action: ConduitRouteActions.POST,
        description: `Send magic link to a user.`,
        bodyParams: {
          email: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition('MagicLinkSendResponse', 'String'),
      this.sendMagicLink.bind(this),
    );
    const config = ConfigController.getInstance().config;
    routingManager.route(
      {
        path: '/hook/magic-link/:verificationToken',
        action: ConduitRouteActions.GET,
        description: `A webhook used to verify a user who has received a magic link.`,
        urlParams: config.customRedirectUris
          ? {
              verificationToken: ConduitString.Required,
              redirectUri: ConduitString.Optional,
            }
          : { verificationToken: ConduitString.Required },
      },
      new ConduitRouteReturnDefinition('VerifyMagicLinkLoginResponse', {
        accessToken: ConduitString.Optional,
        refreshToken: ConduitString.Optional,
      }),
      this.verifyLogin.bind(this),
    );
  }

  async sendMagicLink(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const email = call.request.params.email.toLowerCase();
    const { clientId } = call.request.context;
    const user: User | null = await User.getInstance().findOne({ email });
    if (isNil(user)) throw new GrpcError(status.NOT_FOUND, 'User not found');

    const token: Token = await Token.getInstance().create({
      tokenType: TokenType.MAGIC_LINK,
      user: user._id,
      data: {
        clientId,
      },
      token: uuid(),
    });

    await this.sendMagicLinkMail(user, token);
    return 'token sent';
  }

  async verifyLogin(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { verificationToken } = call.request.params;
    const config = ConfigController.getInstance().config;
    const uri = call.request.params.redirectUri;
    const redirectUri =
      config.customRedirectUris && !isNil(uri) ? uri : config.magic_link.redirect_uri;
    const token: Token | null = await Token.getInstance().findOne({
      tokenType: TokenType.MAGIC_LINK,
      token: verificationToken,
    });
    if (isNil(token)) {
      throw new GrpcError(status.NOT_FOUND, 'Magic link token does not exist');
    }
    const user: User | null = await User.getInstance().findOne({
      _id: token.user! as string,
    });
    if (isNil(user)) throw new GrpcError(status.NOT_FOUND, 'User not found');

    await Token.getInstance()
      .deleteMany({ user: token.user, tokenType: TokenType.MAGIC_LINK })
      .catch(e => {
        ConduitGrpcSdk.Logger.error(e);
      });

    return TokenProvider.getInstance().provideUserTokens(
      {
        user,
        clientId: token.data.clientId,
        config,
      },
      redirectUri,
    );
  }

  private async sendMagicLinkMail(user: User, token: Token) {
    const serverConfig = await this.grpcSdk.config.get('router');
    const url = serverConfig.hostUrl;

    const result = { token, hostUrl: url };
    const link = `${result.hostUrl}/hook/authentication/magic-link/${result.token.token}`;
    await this.emailModule.sendEmail('MagicLink', {
      email: user.email,
      sender: 'no-reply',
      variables: {
        link,
      },
    });
    return 'Email sent';
  }

  private registerTemplate() {
    return this.emailModule.registerTemplate(magicLinkTemplate);
  }
}
