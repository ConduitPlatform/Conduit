import { LocalHandlers } from '../handlers/local';
import { status } from '@grpc/grpc-js';
import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  GrpcError,
  GrpcServer,
  ParsedRouterRequest,
  RoutingManager,
  UnparsedRouterResponse,
} from '@conduitplatform/conduit-grpc-sdk';
import { FacebookHandlers } from '../handlers/facebook/facebook';
import { GoogleHandlers } from '../handlers/google/google';
import { CommonHandlers } from '../handlers/common';
import { ServiceHandler } from '../handlers/service';
import { TwitchHandlers } from '../handlers/twitch/twitch';
import { isNil } from 'lodash';
import moment from 'moment';
import { AccessToken, User } from '../models';
import { ConfigController } from '../config/Config.controller';
import { GoogleSettings } from '../handlers/google/google.settings';
import { FacebookSettings } from '../handlers/facebook/facebook.settings';
import { TwitchSettings } from '../handlers/twitch/twitch.settings';
import { GithubHandlers } from '../handlers/github/github';
import { GithubSettings } from '../handlers/github/github.settings';
import { SlackSettings } from '../handlers/slack/slack.settings';
import { SlackHandlers } from '../handlers/slack/slack';
import { FigmaHandlers } from '../handlers/figma/figma';
import { FigmaSettings } from '../handlers/figma/figma.settings';
import { MicrosoftHandlers } from '../handlers/microsoft/microsoft';
import { MicrosoftSettings } from '../handlers/microsoft/microsoft.settings';

export class AuthenticationRoutes {
  private readonly localHandlers: LocalHandlers;
  private readonly serviceHandler: ServiceHandler;
  private readonly commonHandlers: CommonHandlers;
  private facebookHandlers: FacebookHandlers;
  private googleHandlers: GoogleHandlers;
  private twitchHandlers: TwitchHandlers;
  private githubHandlers: GithubHandlers;
  private slackHandlers: SlackHandlers;
  private figmaHandlers: FigmaHandlers;
  private microsoftHandlers: MicrosoftHandlers;
  private _routingController: RoutingManager;

  constructor(readonly server: GrpcServer, private readonly grpcSdk: ConduitGrpcSdk) {
    this._routingController = new RoutingManager(this.grpcSdk.router, server);
    this.localHandlers = new LocalHandlers(grpcSdk);
    this.serviceHandler = new ServiceHandler(grpcSdk);
    this.commonHandlers = new CommonHandlers(grpcSdk);
  }

  async registerRoutes() {
    let config = null;
    let serverConfig = null;
    this._routingController.clear();
    let enabled = false;

    let errorMessage = null;
    let authActive = await this.localHandlers
      .validate()
      .catch((e: any) => (errorMessage = e));
    if (!errorMessage && authActive) {
      const authConfig = await this.grpcSdk.config
        .get('authentication')
        .catch(console.error);
      this._routingController.route(
        {
          path: '/local/new',
          action: ConduitRouteActions.POST,
          description: `Creates a new user using either email/password or username/password.
               The combination depends on the provided configuration. 
               In the case of email/password the email module is required and 
               the user will receive an email before being able to login.`,
          bodyParams: {
            email: ConduitString.Required,
            password: ConduitString.Required,
          },
          middlewares:
            authConfig.local.identifier === 'username' ? ['authMiddleware'] : [],
        },
        new ConduitRouteReturnDefinition('RegisterResponse', {
          userId: ConduitString.Optional,
        }),
        this.localHandlers.register.bind(this.localHandlers));

      this._routingController.route(
        {
          path: '/local',
          action: ConduitRouteActions.POST,
          description: `Login endpoint that can be used to authenticate. 
              If 2FA is used for the user then instead of tokens 
              you will receive a message indicating the need for a token from the 2FA mechanism.`,
          bodyParams: {
            email: ConduitString.Required,
            password: ConduitString.Required,
          },
        },
        new ConduitRouteReturnDefinition('LoginResponse', {
          userId: ConduitString.Optional,
          accessToken: ConduitString.Optional,
          refreshToken: ConduitString.Optional,
          message: ConduitString.Optional,
        }),
        this.localHandlers.authenticate.bind(this.localHandlers),
      );

      if (authConfig.local.identifier !== 'username') {
        this._routingController.route(
          {
            path: '/forgot-password',
            action: ConduitRouteActions.POST,
            bodyParams: {
              email: ConduitString.Required,
            },
          },
          new ConduitRouteReturnDefinition('ForgotPasswordResponse', 'String'),
          this.localHandlers.forgotPassword.bind(this.localHandlers),
        );

        this._routingController.route(
          {
            path: '/reset-password',
            action: ConduitRouteActions.POST,
            description: `Used after the user clicks on the 'forgot password' link and
                 requires the token from the url and the new password`,
            bodyParams: {
              passwordResetToken: ConduitString.Required,
              password: ConduitString.Required,
            },
          },
          new ConduitRouteReturnDefinition('ResetPasswordResponse', 'String'),
          this.localHandlers.resetPassword.bind(this.localHandlers),
        );

        this._routingController.route(
          {
            path: '/local/change-password',
            action: ConduitRouteActions.POST,
            description: `Changes the user's password but requires the old password first.
                 If 2FA is enabled then a message will be returned asking for token input.`,
            bodyParams: {
              oldPassword: ConduitString.Required,
              newPassword: ConduitString.Required,
            },
            middlewares: ['authMiddleware'],
          },
          new ConduitRouteReturnDefinition('ChangePasswordResponse', 'String'),
          this.localHandlers.changePassword.bind(this.localHandlers),
        );

        this._routingController.route(
          {
            path: '/local/change-password/verify',
            action: ConduitRouteActions.POST,
            description: `Used to provide the 2FA token for password change.`,
            bodyParams: {
              code: ConduitString.Required,
            },
            middlewares: ['authMiddleware'],
          },
          new ConduitRouteReturnDefinition('VerifyChangePasswordResponse', 'String'),
          this.localHandlers.verifyChangePassword.bind(this.localHandlers),
        );

        this._routingController.route(
          {
            path: '/hook/verify-email/:verificationToken',
            action: ConduitRouteActions.GET,
            description: `A webhook used to verify user email. This bypasses the need for clientid/secret`,
            urlParams: {
              verificationToken: ConduitString.Required,
            },
          },
          new ConduitRouteReturnDefinition('VerifyEmailResponse', 'String'),
          this.localHandlers.verifyEmail.bind(this.localHandlers),
        );
      }

      if (authConfig?.twofa.enabled) {
        this._routingController.route(
          {
            path: '/local/twofa',
            action: ConduitRouteActions.POST,
            description: `Verifies the 2FA token.`,
            bodyParams: {
              email: ConduitString.Required,
              code: ConduitString.Required,
            },
          },
          new ConduitRouteReturnDefinition('VerifyTwoFaResponse', {
            userId: ConduitString.Optional,
            accessToken: ConduitString.Optional,
            refreshToken: ConduitString.Optional,
            message: ConduitString.Optional,
          }),
          this.localHandlers.verify.bind(this.localHandlers),
        );

        this._routingController.route(
          {
            path: '/local/enable-twofa',
            action: ConduitRouteActions.UPDATE,
            description: `Enables a phone based 2FA method for a user and 
                requires their phone number.`,
            middlewares: ['authMiddleware'],
            bodyParams: {
              phoneNumber: ConduitString.Required,
            },
          },
          new ConduitRouteReturnDefinition('EnableTwoFaResponse', 'String'),
          this.localHandlers.enableTwoFa.bind(this.localHandlers),
        );

        this._routingController.route(
          {
            path: '/local/verifyPhoneNumber',
            action: ConduitRouteActions.POST,
            description: `Verifies the phone number provided for the 2FA mechanism.`,
            middlewares: ['authMiddleware'],
            bodyParams: {
              code: ConduitString.Required,
            },
          },
          new ConduitRouteReturnDefinition('VerifyPhoneNumberResponse', 'String'),
          this.localHandlers.verifyPhoneNumber.bind(this.localHandlers),
        );

        this._routingController.route(
          {
            path: '/local/disable-twofa',
            action: ConduitRouteActions.UPDATE,
            description: `Disables the user's 2FA mechanism.`,
            middlewares: ['authMiddleware'],
          },
          new ConduitRouteReturnDefinition('DisableTwoFaResponse', 'String'),
          this.localHandlers.disableTwoFa.bind(this.localHandlers),
        );
      }
      enabled = true;
    }
    errorMessage = null;

    config = ConfigController.getInstance().config;
    serverConfig = await this.grpcSdk.config.getServerConfig();
    const facebookSettings: FacebookSettings = {
      providerName: 'facebook',
      authorizeUrl: 'https://www.facebook.com/v11.0/dialog/oauth?',
      clientId: config.facebook.clientId,
      callbackUrl: serverConfig.url + '/hook/authentication/facebook',
      response_type: 'code',
      tokenUrl: 'https://graph.facebook.com/v12.0/oauth/access_token',
      clientSecret: config.facebook.clientSecret,
      accessTokenMethod: 'GET',
      finalRedirect: config.facebook.redirect_uri,
      accountLinking: config.facebook.accountLinking,
      scopeSeperator: ',',
    };
    this.facebookHandlers = new FacebookHandlers(this.grpcSdk, facebookSettings);
    authActive = await this.facebookHandlers
      .validate()
      .catch((e: any) => (errorMessage = e));
    if (!errorMessage && authActive) {
      this._routingController.route(
        {
          path: '/facebook',
          action: ConduitRouteActions.POST,
          description: `Login/register with Facebook by providing a token from the client.`,
          bodyParams: {
            access_token: ConduitString.Required,
          },
        },
        new ConduitRouteReturnDefinition('FacebookResponse', {
          userId: ConduitString.Required,
          accessToken: ConduitString.Required,
          refreshToken: ConduitString.Required,
        }),
        this.facebookHandlers.authenticate.bind(this.facebookHandlers),
      );

      this._routingController.route(
        {
          path: '/init/facebook',
          action: ConduitRouteActions.GET,
          description: `Begins the Facebook authentication`,
        },
        new ConduitRouteReturnDefinition('FacebookInitResponse', 'String'),
        this.facebookHandlers.redirect.bind(this.facebookHandlers),
      );

      this._routingController.route(
        {
          path: '/hook/facebook',
          action: ConduitRouteActions.GET,
          description: `Login/register with Facebook using redirection mechanism.`,
          urlParams: {
            code: ConduitString.Required,
            state: [ConduitString.Optional],
          },
        },
        new ConduitRouteReturnDefinition('FacebookResponse', {
          userId: ConduitString.Required,
          accessToken: ConduitString.Required,
          refreshToken: ConduitString.Required,
        }),
        this.facebookHandlers.authorize.bind(this.facebookHandlers),
      );
      enabled = true;
    }

    config = ConfigController.getInstance().config;
    serverConfig = await this.grpcSdk.config.getServerConfig();
    const googleSettings: GoogleSettings = {
      providerName: 'google',
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth?',
      include_granted_scopes: true,
      clientId: config.google.clientId,
      callbackUrl: serverConfig.url + '/hook/authentication/google',
      response_type: 'code',
      clientSecret: config.google.clientSecret,
      tokenUrl: 'https://oauth2.googleapis.com/token',
      grant_type: 'authorization_code',
      finalRedirect: config.google.redirect_uri,
      accountLinking: config.google.accountLinking,
      accessTokenMethod: 'POST',
    };

    this.googleHandlers = new GoogleHandlers(this.grpcSdk, googleSettings);
    errorMessage = null;
    authActive = await this.googleHandlers
      .validate()
      .catch((e: any) => (errorMessage = e));
    if (!errorMessage && authActive) {
      this._routingController.route(
        {
          path: '/google',
          action: ConduitRouteActions.POST,
          description: `Login/register with Google by providing a token from the client.`,
          bodyParams: {
            id_token: ConduitString.Required,
            access_token: ConduitString.Required,
            expires_in: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition('GoogleResponse', {
          userId: ConduitString.Required,
          accessToken: ConduitString.Required,
          refreshToken: ConduitString.Required,
        }),
        this.googleHandlers.authenticate.bind(this.googleHandlers),
      );

      this._routingController.route(
        {
          path: '/init/google',
          action: ConduitRouteActions.GET,
          description: `Begins the Google authentication`,
        },
        new ConduitRouteReturnDefinition('GoogleInitResponse', 'String'),
        this.googleHandlers.redirect.bind(this.googleHandlers),
      );

      this._routingController.route(
        {
          path: '/hook/google',
          action: ConduitRouteActions.GET,
          description: `Login/register with Google using redirection mechanism.`,
          urlParams: {
            code: ConduitString.Required,
            state: [ConduitString.Required],
          },
        },
        new ConduitRouteReturnDefinition('GoogleResponse', {
          userId: ConduitString.Required,
          accessToken: ConduitString.Required,
          refreshToken: ConduitString.Required,
        }),
        this.googleHandlers.authorize.bind(this.googleHandlers),
      );

      enabled = true;
    }

    config = ConfigController.getInstance().config;
    serverConfig = await this.grpcSdk.config.getServerConfig();
    const githubSettings: GithubSettings = {
      providerName: 'github',
      authorizeUrl: 'https://github.com/login/oauth/authorize?',
      clientId: config.github.clientId,
      callbackUrl: serverConfig.url + '/hook/authentication/github',
      response_type: 'code',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      clientSecret: config.github.clientSecret,
      accessTokenMethod: 'POST',
      finalRedirect: config.github.redirect_uri,
      accountLinking: config.github.accountLinking,
    };

    this.githubHandlers = new GithubHandlers(this.grpcSdk, githubSettings);
    errorMessage = null;
    authActive = await this.googleHandlers
      .validate()
      .catch((e: any) => (errorMessage = e));
    if (!errorMessage && authActive) {
      this._routingController.route(
        {
          path: '/init/github',
          action: ConduitRouteActions.GET,
          description: `Begins the Github authentication`,
        },
        new ConduitRouteReturnDefinition('GithubInitResponse', 'String'),
        this.githubHandlers.redirect.bind(this.githubHandlers),
      );

      this._routingController.route(
        {
          path: '/hook/github',
          action: ConduitRouteActions.GET,
          description: `Login/register with Github using redirection mechanism.`,
          urlParams: {
            code: ConduitString.Required,
            state: [ConduitString.Required],
          },
        },
        new ConduitRouteReturnDefinition('GithubResponse', {
          userId: ConduitString.Required,
          accessToken: ConduitString.Required,
          refreshToken: ConduitString.Required,
        }),
        this.githubHandlers.authorize.bind(this.githubHandlers),
      );

      enabled = true;
    }

    config = ConfigController.getInstance().config;
    serverConfig = await this.grpcSdk.config.getServerConfig();
    const slackSettings: SlackSettings = {
      providerName: 'slack',
      authorizeUrl: 'https://slack.com/oauth/authorize?',
      clientId: config.slack.clientId,
      callbackUrl: serverConfig.url + '/hook/authentication/slack',
      response_type: 'code',
      tokenUrl: 'https://slack.com/api/oauth.access',
      clientSecret: config.slack.clientSecret,
      accessTokenMethod: 'POST',
      finalRedirect: config.slack.redirect_uri,
      accountLinking: config.slack.accountLinking,
    };

    this.slackHandlers = new SlackHandlers(this.grpcSdk, slackSettings);
    errorMessage = null;
    authActive = await this.slackHandlers
      .validate()
      .catch((e: any) => (errorMessage = e));
    if (!errorMessage && authActive) {
      this._routingController.route(
        {
          path: '/init/slack',
          action: ConduitRouteActions.GET,
          description: `Begins the Slack authentication`,
        },
        new ConduitRouteReturnDefinition('SlackInitResponse', 'String'),
        this.slackHandlers.redirect.bind(this.slackHandlers),
      );

      this._routingController.route(
        {
          path: '/hook/slack',
          action: ConduitRouteActions.GET,
          description: `Login/register with Slack using redirection mechanism.`,
          urlParams: {
            code: ConduitString.Required,
            state: [ConduitString.Required],
          },
        },
        new ConduitRouteReturnDefinition('SlackResponse', {
          userId: ConduitString.Required,
          accessToken: ConduitString.Required,
          refreshToken: ConduitString.Required,
        }),
        this.slackHandlers.authorize.bind(this.slackHandlers),
      );
      enabled = true;
    }

    config = ConfigController.getInstance().config;
    serverConfig = await this.grpcSdk.config.getServerConfig();
    const figmaSettings: FigmaSettings = {
      providerName: 'figma',
      authorizeUrl: 'https://www.figma.com/oauth?',
      clientId: config.figma.clientId,
      callbackUrl: serverConfig.url + '/hook/authentication/figma',
      response_type: 'code',
      tokenUrl: 'https://www.figma.com/api/oauth/token',
      clientSecret: config.figma.clientSecret,
      accessTokenMethod: 'POST',
      finalRedirect: config.figma.redirect_uri,
      accountLinking: config.figma.accountLinking,
      grant_type: 'authorization_code',
    };

    this.figmaHandlers = new FigmaHandlers(this.grpcSdk, figmaSettings);
    errorMessage = null;
    authActive = await this.figmaHandlers
      .validate()
      .catch((e: any) => (errorMessage = e));
    if (!errorMessage && authActive) {
      this._routingController.route(
        {
          path: '/init/figma',
          action: ConduitRouteActions.GET,
          description: `Begins the Figma authentication`,
        },
        new ConduitRouteReturnDefinition('FigmaInitResponse', 'String'),
        this.figmaHandlers.redirect.bind(this.figmaHandlers),
      );
      this._routingController.route(
        {
          path: '/hook/figma',
          action: ConduitRouteActions.GET,
          description: `Login/register with Figma using redirection mechanism.`,
          urlParams: {
            code: ConduitString.Required,
            state: [ConduitString.Required],
          },
        },
        new ConduitRouteReturnDefinition('FigmaResponse', {
          userId: ConduitString.Required,
          accessToken: ConduitString.Required,
          refreshToken: ConduitString.Required,
        }),
        this.figmaHandlers.authorize.bind(this.figmaHandlers),
      );
      enabled = true;
    }

    config = ConfigController.getInstance().config;
    serverConfig = await this.grpcSdk.config.getServerConfig();
    const microsoftSettings: MicrosoftSettings = {
      providerName: 'microsoft',
      authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?',
      clientId: config.microsoft.clientId,
      callbackUrl: serverConfig.url + '/hook/authentication/microsoft',
      response_type: 'code',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      clientSecret: config.microsoft.clientSecret,
      accessTokenMethod: 'POST',
      finalRedirect: config.microsoft.redirect_uri,
      accountLinking: config.microsoft.accountLinking,
      grant_type: 'authorization_code',
      response_mode: 'form_post',
    };

    this.microsoftHandlers = new MicrosoftHandlers(this.grpcSdk, microsoftSettings);
    errorMessage = null;
    authActive = await this.microsoftHandlers
      .validate()
      .catch((e: any) => (errorMessage = e));
    if (!errorMessage && authActive) {
      this._routingController.route(
        {
          path: '/init/microsoft',
          action: ConduitRouteActions.GET,
          description: `Begins the Microsoft authentication`,
        },
        new ConduitRouteReturnDefinition('MicrosoftInitResponse', 'String'),
        this.microsoftHandlers.redirect.bind(this.microsoftHandlers),
      );
      this._routingController.route(
        {
          path: '/hook/microsoft',
          action: ConduitRouteActions.GET,
          description: `Login/register with Microsoft using redirection mechanism.`,
          urlParams: {
            code: ConduitString.Required,
            state: [ConduitString.Required],
          },
        },
        new ConduitRouteReturnDefinition('MicrosoftResponse', {
          userId: ConduitString.Required,
          accessToken: ConduitString.Required,
          refreshToken: ConduitString.Required,
        }),
        this.microsoftHandlers.authorize.bind(this.microsoftHandlers),
      );
      enabled = true;
    }

    errorMessage = null;
    authActive = await this.serviceHandler
      .validate()
      .catch((e: any) => (errorMessage = e));
    if (!errorMessage && authActive) {
      this._routingController.route(
        {
          path: '/service',
          action: ConduitRouteActions.POST,
          description: `Login with service account.`,
          bodyParams: {
            serviceName: ConduitString.Required,
            token: ConduitString.Required,
          },
        },
        new ConduitRouteReturnDefinition('VerifyServiceResponse', {
          serviceId: ConduitString.Required,
          accessToken: ConduitString.Required,
          refreshToken: ConduitString.Required,
        }),
        this.serviceHandler.authenticate.bind(this.serviceHandler),
      );

      enabled = true;
    }

    config = ConfigController.getInstance().config;
    serverConfig = await this.grpcSdk.config.getServerConfig();

    const twitchSettings: TwitchSettings = {
      providerName: 'twitch',
      authorizeUrl: 'https://id.twitch.tv/oauth2/authorize?',
      clientId: config.twitch.clientId,
      callbackUrl: serverConfig.url + '/hook/authentication/twitch',
      response_type: 'code',
      grant_type: 'authorization_code',
      clientSecret: config.twitch.clientSecret,
      tokenUrl: 'https://id.twitch.tv/oauth2/token',
      accessTokenMethod: 'POST',
      finalRedirect: config.twitch.redirect_uri,
      accountLinking: config.twitch.accountLinking,
    };

    this.twitchHandlers = new TwitchHandlers(this.grpcSdk, twitchSettings);
    errorMessage = null;
    authActive = await this.twitchHandlers
      .validate()
      .catch((e: any) => (errorMessage = e));
    if (!errorMessage && authActive) {

      this._routingController.route(
        {
          path: '/hook/twitch',
          action: ConduitRouteActions.GET,
          description: `Login/register with Twitch using redirection mechanism.`,
          urlParams: {
            code: ConduitString.Required,
            state: [ConduitString.Required],
          },
        },
        new ConduitRouteReturnDefinition('TwitchResponse', {
          userId: ConduitString.Required,
          accessToken: ConduitString.Required,
          refreshToken: ConduitString.Required,
        }),
        this.twitchHandlers.authorize.bind(this.twitchHandlers),
      );

      this._routingController.route(
        {
          path: '/init/twitch',
          description: `Begins the Twitch authentication.`,
          action: ConduitRouteActions.GET,
        },
        new ConduitRouteReturnDefinition('TwitchInitResponse', 'String'),
        this.twitchHandlers.redirect.bind(this.twitchHandlers),
      );

      enabled = true;
    }

    if (enabled) {
      this._routingController.route(
        {
          path: '/user',
          description: `Returns the authenticated user.`,
          action: ConduitRouteActions.GET,
          middlewares: ['authMiddleware'],
        },
        new ConduitRouteReturnDefinition('User', User.getInstance().fields),
        this.commonHandlers.getUser.bind(this.commonHandlers),
      );
      this._routingController.route(
        {
          path: '/user',
          description: `Deletes the authenticated user.`,
          action: ConduitRouteActions.DELETE,
          middlewares: ['authMiddleware'],
        },
        new ConduitRouteReturnDefinition('DeleteUserResponse', 'String'),
        this.commonHandlers.deleteUser.bind(this.commonHandlers),
      );
      this._routingController.route(
        {
          path: '/renew',
          action: ConduitRouteActions.POST,
          description: `Renews the access and refresh tokens 
              when provided with a valid refresh token.`,
          bodyParams: {
            refreshToken: ConduitString.Required,
          },
        },
        new ConduitRouteReturnDefinition('RenewAuthenticationResponse', {
          accessToken: ConduitString.Required,
          refreshToken: ConduitString.Required,
        }),
        this.commonHandlers.renewAuth.bind(this.commonHandlers),
      );

      this._routingController.route(
        {
          path: '/logout',
          action: ConduitRouteActions.POST,
          middlewares: ['authMiddleware'],
        },
        new ConduitRouteReturnDefinition('LogoutResponse', 'String'),
        this.commonHandlers.logOut.bind(this.commonHandlers),
      );

      this._routingController.middleware({ path: '/', name: 'authMiddleware' }, this.middleware.bind(this));
    }
    return this._routingController.registerRoutes()
      .catch((err: Error) => {
        console.log('Failed to register routes for module');
        console.log(err);
      });
  }

  async middleware(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    let context = call.request.context;
    let headers = call.request.headers;

    const header = (headers['Authorization'] || headers['authorization']) as string;
    if (isNil(header)) {
      throw new GrpcError(status.UNAUTHENTICATED, 'No authorization header present');
    }
    const args = header.split(' ');

    if (args[0] !== 'Bearer' || isNil(args[1])) {
      throw new GrpcError(status.UNAUTHENTICATED, 'Authorization header malformed');
    }

    let accessToken = await AccessToken.getInstance().findOne({
      token: args[1],
      clientId: context.clientId,
    });
    if (isNil(accessToken) || moment().isAfter(moment(accessToken.expiresOn))) {
      throw new GrpcError(
        status.UNAUTHENTICATED,
        'Token is expired or otherwise not valid',
      );
    }
    if (!accessToken.userId) {
      throw new GrpcError(
        status.UNAUTHENTICATED,
        'Token is expired or otherwise not valid',
      );
    }

    let user = await User.getInstance().findOne({
      _id: accessToken.userId,
    });
    if (isNil(user)) {
      throw new GrpcError(status.UNAUTHENTICATED, 'User no longer exists');
    }
    return { user: user };
  }
}
