import { LocalHandlers } from '../handlers/local';
import { status } from '@grpc/grpc-js';
import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  ConfigController,
  GrpcError,
  GrpcServer,
  ParsedRouterRequest,
  RoutingManager,
  TYPE,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { FacebookHandlers } from '../handlers/facebook/facebook';
import { GoogleHandlers } from '../handlers/google/google';
import { CommonHandlers } from '../handlers/common';
import { ServiceHandler } from '../handlers/service';
import { TwitchHandlers } from '../handlers/twitch/twitch';
import { isNil } from 'lodash';
import moment from 'moment';
import { AccessToken, User } from '../models';
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
import { PhoneHandlers } from '../handlers/phone';

export class AuthenticationRoutes {
  private readonly localHandlers: LocalHandlers;
  private readonly serviceHandler: ServiceHandler;
  private readonly commonHandlers: CommonHandlers;
  private readonly phoneHandlers: PhoneHandlers;
  private facebookHandlers: FacebookHandlers;
  private googleHandlers: GoogleHandlers;
  private twitchHandlers: TwitchHandlers;
  private githubHandlers: GithubHandlers;
  private slackHandlers: SlackHandlers;
  private figmaHandlers: FigmaHandlers;
  private microsoftHandlers: MicrosoftHandlers;
  private readonly _routingManager: RoutingManager;

  constructor(readonly server: GrpcServer, private readonly grpcSdk: ConduitGrpcSdk) {
    this._routingManager = new RoutingManager(this.grpcSdk.router, server);
    this.localHandlers = new LocalHandlers(grpcSdk);
    this.serviceHandler = new ServiceHandler(grpcSdk);
    this.commonHandlers = new CommonHandlers(grpcSdk);
    this.phoneHandlers = new PhoneHandlers(grpcSdk, this._routingManager);
  }

  async registerRoutes() {
    let config = null;
    let serverConfig = null;
    this._routingManager.clear();
    let enabled = false;
    let errorMessage = null;
    let phoneActive = await this.phoneHandlers
      .validate()
      .catch((e: any) => (errorMessage = e));

    if (phoneActive && !errorMessage) {
      await this.phoneHandlers.declareRoutes();
    }

    let authActive = await this.localHandlers
      .validate()
      .catch((e: any) => (errorMessage = e));
    if (!errorMessage && authActive) {
      const authConfig = await this.grpcSdk.config
        .get('authentication')
        .catch(console.error);
      this._routingManager.route(
        {
          path: '/local/new',
          action: ConduitRouteActions.POST,
          description: 'Creates a new user using email/password.',
          bodyParams: {
            email: ConduitString.Required,
            password: ConduitString.Required,
          },
          middlewares: [],
        },
        new ConduitRouteReturnDefinition('RegisterResponse', {
          userId: ConduitString.Optional,
        }),
        this.localHandlers.register.bind(this.localHandlers));

      this._routingManager.route(
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
          cookies: { type: TYPE.JSON, required: false },
        }),
        this.localHandlers.authenticate.bind(this.localHandlers),
      );

      let emailOnline = false;
      await this.grpcSdk.config.moduleExists('email')
        .then(_ => {
          emailOnline = true;
        })
        .catch(_ => {
        });
      if (emailOnline) {
        this._routingManager.route(
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

        this._routingManager.route(
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
      }

      this._routingManager.route(
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

      this._routingManager.route(
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

      if (authConfig?.twofa.enabled) {
        this._routingManager.route(
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
          this.localHandlers.verify2FA.bind(this.localHandlers),
        );

        this._routingManager.route(
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

        this._routingManager.route(
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

        this._routingManager.route(
          {
            path: '/local/disable-twofa',
            action: ConduitRouteActions.UPDATE,
            description: `Disables the user's 2FA mechanism.`,
            middlewares: ['authMiddleware'],
          },
          new ConduitRouteReturnDefinition('DisableTwoFaResponse', 'String'),
          this.localHandlers.disableTwoFa.bind(this.localHandlers),
        );

        this._routingManager.route(
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
      }
      enabled = true;
    }
    errorMessage = null;

    config = ConfigController.getInstance().config;
    serverConfig = await this.grpcSdk.config.getServerConfig();
    this.facebookHandlers = new FacebookHandlers(this.grpcSdk, this._routingManager, new FacebookSettings(this.grpcSdk, config, serverConfig.url));
    authActive = await this.facebookHandlers
      .validate()
      .catch((e: any) => (errorMessage = e));
    if (!errorMessage && authActive) {
      this.facebookHandlers.declareRoutes();
      enabled = true;
    }

    this.googleHandlers = new GoogleHandlers(this.grpcSdk, this._routingManager, new GoogleSettings(this.grpcSdk, config, serverConfig.url));
    errorMessage = null;
    authActive = await this.googleHandlers
      .validate()
      .catch((e: any) => (errorMessage = e));
    if (!errorMessage && authActive) {
      this.googleHandlers.declareRoutes();
      enabled = true;
    }

    this.githubHandlers = new GithubHandlers(this.grpcSdk, this._routingManager, new GithubSettings(this.grpcSdk, config, serverConfig.url));
    errorMessage = null;
    authActive = await this.githubHandlers
      .validate()
      .catch((e: any) => (errorMessage = e));
    if (!errorMessage && authActive) {
      this.githubHandlers.declareRoutes();
      enabled = true;
    }

    this.slackHandlers = new SlackHandlers(this.grpcSdk, this._routingManager, new SlackSettings(this.grpcSdk, config, serverConfig.url));
    errorMessage = null;
    authActive = await this.slackHandlers
      .validate()
      .catch((e: any) => (errorMessage = e));
    if (!errorMessage && authActive) {
      this.slackHandlers.declareRoutes();
      enabled = true;
    }

    this.figmaHandlers = new FigmaHandlers(this.grpcSdk, this._routingManager, new FigmaSettings(this.grpcSdk, config, serverConfig.url));
    errorMessage = null;
    authActive = await this.figmaHandlers
      .validate()
      .catch((e: any) => (errorMessage = e));
    if (!errorMessage && authActive) {
      this.figmaHandlers.declareRoutes();
      enabled = true;
    }

    this.microsoftHandlers = new MicrosoftHandlers(this.grpcSdk, this._routingManager, new MicrosoftSettings(this.grpcSdk, config, serverConfig.url));
    errorMessage = null;
    authActive = await this.microsoftHandlers
      .validate()
      .catch((e: any) => (errorMessage = e));
    if (!errorMessage && authActive) {
      this.microsoftHandlers.declareRoutes();
      enabled = true;
    }

    errorMessage = null;
    authActive = await this.serviceHandler
      .validate()
      .catch((e: any) => (errorMessage = e));
    if (!errorMessage && authActive) {
      this._routingManager.route(
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
    this.twitchHandlers = new TwitchHandlers(this.grpcSdk, this._routingManager, new TwitchSettings(this.grpcSdk, config, serverConfig.url));
    errorMessage = null;
    authActive = await this.twitchHandlers
      .validate()
      .catch((e: any) => (errorMessage = e));
    if (!errorMessage && authActive) {
      this.twitchHandlers.declareRoutes();
      enabled = true;
    }
    if (enabled) {
      this._routingManager.route(
        {
          path: '/user',
          description: `Returns the authenticated user.`,
          action: ConduitRouteActions.GET,
          middlewares: ['authMiddleware'],
        },
        new ConduitRouteReturnDefinition('User', User.getInstance().fields),
        this.commonHandlers.getUser.bind(this.commonHandlers),
      );
      this._routingManager.route(
        {
          path: '/user',
          description: `Deletes the authenticated user.`,
          action: ConduitRouteActions.DELETE,
          middlewares: ['authMiddleware'],
        },
        new ConduitRouteReturnDefinition('DeleteUserResponse', 'String'),
        this.commonHandlers.deleteUser.bind(this.commonHandlers),
      );
      this._routingManager.route(
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

      this._routingManager.route(
        {
          path: '/logout',
          action: ConduitRouteActions.POST,
          middlewares: ['authMiddleware'],
        },
        new ConduitRouteReturnDefinition('LogoutResponse', 'String'),
        this.commonHandlers.logOut.bind(this.commonHandlers),
      );

      this._routingManager.middleware({ path: '/', name: 'authMiddleware' }, this.middleware.bind(this));
    }
    return this._routingManager.registerRoutes()
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
