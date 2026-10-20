import { isEmpty, isNil } from 'lodash-es';
import { TokenType } from '../constants/index.js';
import { v4 as uuid } from 'uuid';
import {
  ConduitGrpcSdk,
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
import { Client, Token, User } from '../models/index.js';
import { status } from '@grpc/grpc-js';
import {
  EMAIL_SEND_STRICT,
  MAGIC_LINK_EXCHANGE,
  OAUTH_CALLBACK,
} from '../constants/index.js';
import { IAuthenticationStrategy } from '../interfaces/index.js';
import { TokenProvider } from './tokenProvider.js';
import { MagicLinkTemplate as magicLinkTemplate } from '../templates/index.js';
import { AuthUtils } from '../utils/index.js';
import { errors } from '../errors.js';
import {
  assertGlobalStrategyAvailable,
  assertStrategyForPrincipal,
  realmIdOf,
  realmParam,
  resolvePrincipal,
  resolveRealmFromCall,
  resolveRealmFromSlug,
} from './realmRequest.js';
import { anyRealmEnables } from '../utils/strategyRealms.js';
import { RealmContext } from '../utils/realm.js';

export class MagicLinkHandlers implements IAuthenticationStrategy {
  private emailModule: Email;
  private initialized: boolean = false;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  async validate(): Promise<boolean> {
    const config = ConfigController.getInstance().config;
    // a realm may enable magic link on its own: the email client and template are
    // needed then as well
    const enabled = config.magic_link.enabled || (await anyRealmEnables('magicLink'));
    if (enabled && this.grpcSdk.isAvailable('email')) {
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
          realm: realmParam,
        },
        errors: [
          errors.REALM_NOT_FOUND,
          errors.REALMS_DISABLED,
          errors.STRATEGY_NOT_AVAILABLE_FOR_REALM,
        ],
        rateLimit: EMAIL_SEND_STRICT,
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
        rateLimit: OAUTH_CALLBACK,
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
          rateLimit: MAGIC_LINK_EXCHANGE,
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
    const realmCtx = await resolveRealmFromCall(call);
    if (!realmCtx) assertGlobalStrategyAvailable('magicLink');
    const user: User | null = (await resolvePrincipal(realmCtx, { email }))?.user ?? null;
    await assertStrategyForPrincipal(realmCtx, user, 'magicLink');
    if (isNil(user)) throw new GrpcError(status.NOT_FOUND, 'User not found');
    if (user.isAnonymous) throw new GrpcError(status.PERMISSION_DENIED, 'Anonymous user');

    const token: Token = await Token.getInstance().create({
      tokenType: TokenType.MAGIC_LINK,
      user: user._id,
      data: {
        clientId,
        ...(redirectUri !== undefined ? { redirectUri } : {}),
        ...(realmCtx ? { realm: realmCtx.team.realm!.slug } : {}),
      },
      token: uuid(),
    });

    await this.sendMagicLinkMail(user, token);
    return 'token sent';
  }

  async verifyLogin(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { verificationToken } = call.request.urlParams;
    const config = ConfigController.getInstance().config;
    const { user, data, realmCtx } = await this.redeemMagicToken(verificationToken);
    const redirectUri =
      AuthUtils.validateRedirectUri(data.redirectUri) ??
      config.magic_link.redirect_uri.replace(/\/$/, '');
    return TokenProvider.getInstance().provideUserTokens(
      {
        user,
        clientId: data.clientId,
        config,
        realm: realmIdOf(realmCtx),
      },
      redirectUri,
    );
  }

  private async exchangeMagicToken(
    call: ParsedRouterRequest,
  ): Promise<UnparsedRouterResponse> {
    const { magicToken } = call.request.urlParams;
    const { user, data, realmCtx } = await this.redeemMagicToken(magicToken);
    const config = ConfigController.getInstance().config;
    return TokenProvider.getInstance().provideUserTokens({
      user,
      clientId: data.clientId,
      config,
      realm: realmIdOf(realmCtx),
    });
  }

  private async redeemMagicToken(magicToken: string): Promise<{
    user: User;
    data: Token['data'] & { clientId: Client['clientId'] };
    realmCtx: RealmContext | null;
  }> {
    const token: Token | null = await Token.getInstance().findOne(
      {
        tokenType: TokenType.MAGIC_LINK,
        token: magicToken,
      },
      { readPreference: 'primary' },
    );
    if (isNil(token)) {
      throw new GrpcError(status.NOT_FOUND, 'Magic link token does not exist');
    }
    const user: User | null = await User.getInstance().findOne({
      _id: token.user! as string,
    });
    if (isNil(user)) throw new GrpcError(status.NOT_FOUND, 'User not found');
    // the realm the link was requested for, re-validated at redemption
    const realmCtx = await resolveRealmFromSlug(token.data?.realm);
    if (!realmCtx) assertGlobalStrategyAvailable('magicLink');
    await assertStrategyForPrincipal(realmCtx, user, 'magicLink');
    await Token.getInstance()
      .deleteMany({ user: token.user, tokenType: TokenType.MAGIC_LINK })
      .catch(e => {
        ConduitGrpcSdk.Logger.error(e);
      });
    return {
      user,
      data: token.data,
      realmCtx,
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
