import { LocalHandlers } from '../handlers/local';
import { status } from '@grpc/grpc-js';
import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  GrpcError,
  GrpcServer,
  ParsedRouterRequest,
  UnparsedRouterResponse,
  RoutingManager
} from '@conduitplatform/grpc-sdk';
import { FacebookHandlers } from '../handlers/facebook';
import { GoogleHandlers } from '../handlers/google';
import { CommonHandlers } from '../handlers/common';
import { ServiceHandler } from '../handlers/service';
import { TwitchHandlers } from '../handlers/twitch';
import { isNil } from 'lodash';
import moment from 'moment';
import { AccessToken, User } from '../models';

export class AuthenticationRoutes {
  private readonly localHandlers: LocalHandlers;
  private readonly facebookHandlers: FacebookHandlers;
  private readonly googleHandlers: GoogleHandlers;
  private readonly serviceHandler: ServiceHandler;
  private readonly commonHandlers: CommonHandlers;
  private readonly twitchHandlers: TwitchHandlers;
  private _routingController: RoutingManager;

  constructor(readonly server: GrpcServer, private readonly grpcSdk: ConduitGrpcSdk) {
    this._routingController = new RoutingManager(this.grpcSdk.router, server);
    this.localHandlers = new LocalHandlers(grpcSdk);
    this.facebookHandlers = new FacebookHandlers(grpcSdk);
    this.googleHandlers = new GoogleHandlers(grpcSdk);
    this.serviceHandler = new ServiceHandler(grpcSdk);
    this.twitchHandlers = new TwitchHandlers(grpcSdk);
    this.commonHandlers = new CommonHandlers(grpcSdk);
  }

  async registerRoutes() {
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

      enabled = true;
    }

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
            state: ConduitString.Required,
          },
        },
        new ConduitRouteReturnDefinition('TwitchResponse', {
          userId: ConduitString.Required,
          accessToken: ConduitString.Required,
          refreshToken: ConduitString.Required,
        }),
        this.twitchHandlers.authenticate.bind(this.twitchHandlers),
      );
      this._routingController.route(
        {
          path: '/init/twitch',
          description: `Begins the Twitch authentication.`,
          action: ConduitRouteActions.GET,
        },
        new ConduitRouteReturnDefinition('TwitchInitResponse', 'String'),
        this.twitchHandlers.beginAuth.bind(this.twitchHandlers),
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
