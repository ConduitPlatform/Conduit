import { isEmpty, isNil } from 'lodash';
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
import { Client, Token, User } from '../models';
import { status } from '@grpc/grpc-js';
import { IAuthenticationStrategy } from '../interfaces';
import { TokenProvider } from './tokenProvider';
import { MagicLinkTemplate as magicLinkTemplate } from '../templates';
import { AuthUtils } from '../utils';

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
    const config = ConfigController.getInstance().config;
    routingManager.route(
      {
        path: '/magic-link',
        action: ConduitRouteActions.POST,
        description: `Send magic link to a user.`,
        bodyParams: {
          email: ConduitString.Required,
          redirectUri: ConduitString.Optional,
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
        accessToken: ConduitString.Optional,
        refreshToken: ConduitString.Optional,
      }),
      this.verifyLogin.bind(this),
    );
    if (!isEmpty(config.magic_link.link_uri)) {
      routingManager.route(
        {
          path: '/magic-link/:magicToken',
          action: ConduitRouteActions.POST,
          description: 'Exchange magic token for login tokens.',
          urlParams: {
            magicToken: ConduitString.Required,
          },
        },
        new ConduitRouteReturnDefinition('MagicLinkExchangeResponse', {
          accessToken: ConduitString.Optional,
          refreshToken: ConduitString.Optional,
        }),
        this.exchangeMagicToken.bind(this),
      );
    }
  }

  async sendMagicLink(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const email = call.request.params.email.toLowerCase();
    const redirectUri = AuthUtils.validateRedirectUri(
      call.request.bodyParams.redirectUri,
    );
    const { clientId } = call.request.context;
    const user: User | null = await User.getInstance().findOne({ email });
    if (isNil(user)) throw new GrpcError(status.NOT_FOUND, 'User not found');

    const token: Token = await Token.getInstance().create({
      tokenType: TokenType.MAGIC_LINK,
      user: user._id,
      data: {
        clientId,
        ...(redirectUri !== undefined ? { redirectUri } : {}),
      },
      token: uuid(),
    });

    await this.sendMagicLinkMail(user, token);
    return 'token sent';
  }

  async verifyLogin(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { verificationToken } = call.request.urlParams;
    const config = ConfigController.getInstance().config;
    const { user, data } = await this.redeemMagicToken(verificationToken);
    const redirectUri =
      AuthUtils.validateRedirectUri(data.redirectUri) ??
      config.magic_link.redirect_uri.replace(/\/$/, '');
    return TokenProvider.getInstance().provideUserTokens(
      {
        user,
        clientId: data.clientId,
        config,
      },
      redirectUri,
    );
  }

  private async exchangeMagicToken(
    call: ParsedRouterRequest,
  ): Promise<UnparsedRouterResponse> {
    const { magicToken } = call.request.urlParams;
    const { user, data } = await this.redeemMagicToken(magicToken);
    return TokenProvider.getInstance().provideUserTokens({
      user,
      clientId: data.clientId,
      config: ConfigController.getInstance().config,
    });
  }

  private async redeemMagicToken(
    magicToken: string,
  ): Promise<{ user: User; data: Token['data'] & { clientId: Client['clientId'] } }> {
    const token: Token | null = await Token.getInstance().findOne({
      tokenType: TokenType.MAGIC_LINK,
      token: magicToken,
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
    return {
      user,
      data: token.data,
    };
  }

  private async sendMagicLinkMail(user: User, token: Token) {
    const linkUri = ConfigController.getInstance().config.magic_link.link_uri?.replace(
      /\/$/,
      '',
    );
    const serverConfig = await this.grpcSdk.config.get('router');
    const baseUrl = !isEmpty(linkUri)
      ? linkUri
      : `${serverConfig.hostUrl.replace(/\/$/, '')}/hook/authentication/magic-link`;
    const link = `${baseUrl}/${token.token}`;
    await this.emailModule.sendEmail('MagicLink', {
      email: user.email,
      sender: 'no-reply',
      variables: {
        user,
        link,
      },
    });
    return 'Email sent';
  }

  private registerTemplate() {
    return this.emailModule.registerTemplate(magicLinkTemplate);
  }
}
