import { LocalHandlers } from '../handlers/local';
import * as grpc from 'grpc';
import ConduitGrpcSdk, {
  ConduitMiddleware,
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  constructMiddleware,
  constructRoute,
  GrpcError,
  GrpcServer,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import { FacebookHandlers } from '../handlers/facebook';
import { GoogleHandlers } from '../handlers/google';
import { CommonHandlers } from '../handlers/common';
import { ServiceHandler } from '../handlers/service';
import { KakaoHandlers } from '../handlers/kakao';
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
  private readonly kakaoHandlers: KakaoHandlers;
  private readonly twitchHandlers: TwitchHandlers;

  constructor(readonly server: GrpcServer, private readonly grpcSdk: ConduitGrpcSdk) {
    this.localHandlers = new LocalHandlers(grpcSdk);
    this.facebookHandlers = new FacebookHandlers(grpcSdk);
    this.googleHandlers = new GoogleHandlers(grpcSdk);
    this.serviceHandler = new ServiceHandler(grpcSdk);
    this.kakaoHandlers = new KakaoHandlers(grpcSdk);
    this.twitchHandlers = new TwitchHandlers(grpcSdk);
    this.commonHandlers = new CommonHandlers(grpcSdk);
  }

  async registerRoutes() {
    let activeRoutes = await this.getRegisteredRoutes();
    this.grpcSdk.router
      .registerRouterAsync(this.server, activeRoutes, {
        register: this.localHandlers.register.bind(this.localHandlers),
        authenticateLocal: this.localHandlers.authenticate.bind(this.localHandlers),
        forgotPassword: this.localHandlers.forgotPassword.bind(this.localHandlers),
        resetPassword: this.localHandlers.resetPassword.bind(this.localHandlers),
        changePassword: this.localHandlers.changePassword.bind(this.localHandlers),
        verifyChangePassword: this.localHandlers.verifyChangePassword.bind(
          this.localHandlers
        ),
        verifyEmail: this.localHandlers.verifyEmail.bind(this.localHandlers),
        verifyTwoFa: this.localHandlers.verify.bind(this.localHandlers),
        enableTwoFa: this.localHandlers.enableTwoFa.bind(this.localHandlers),
        verifyPhoneNumber: this.localHandlers.verifyPhoneNumber.bind(this.localHandlers),
        disableTwoFa: this.localHandlers.disableTwoFa.bind(this.localHandlers),
        authenticateFacebook: this.facebookHandlers.authenticate.bind(
          this.facebookHandlers
        ),
        authenticateGoogle: this.googleHandlers.authenticate.bind(this.googleHandlers),
        authenticateService: this.serviceHandler.authenticate.bind(this.serviceHandler),
        authenticateKakao: this.kakaoHandlers.authenticate.bind(this.kakaoHandlers),
        beginAuthKakao: this.kakaoHandlers.beginAuth.bind(this.kakaoHandlers),
        authenticateTwitch: this.twitchHandlers.authenticate.bind(this.twitchHandlers),
        beginAuthTwitch: this.twitchHandlers.beginAuth.bind(this.twitchHandlers),
        renewAuth: this.commonHandlers.renewAuth.bind(this.commonHandlers),
        logOut: this.commonHandlers.logOut.bind(this.commonHandlers),
        getUser: this.commonHandlers.getUser.bind(this.commonHandlers),
        deleteUser: this.commonHandlers.deleteUser.bind(this.commonHandlers),
        authMiddleware: this.middleware.bind(this),
      })
      .catch((err: Error) => {
        console.log('Failed to register routes for module');
        console.log(err);
      });
  }

  async getRegisteredRoutes(): Promise<any[]> {
    let routesArray: any[] = [];

    let enabled = false;

    let errorMessage = null;
    let authActive = await this.localHandlers
      .validate()
      .catch((e: any) => (errorMessage = e));
    if (!errorMessage && authActive) {
      const authConfig = await this.grpcSdk.config
        .get('authentication')
        .catch(console.error);

      routesArray.push(
        constructRoute(
          new ConduitRoute(
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
            'register'
          )
        )
      );

      routesArray.push(
        constructRoute(
          new ConduitRoute(
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
            'authenticateLocal'
          )
        )
      );

      if (authConfig.local.identifier !== 'username') {
        routesArray.push(
          constructRoute(
            new ConduitRoute(
              {
                path: '/forgot-password',
                action: ConduitRouteActions.POST,
                bodyParams: {
                  email: ConduitString.Required,
                },
              },
              new ConduitRouteReturnDefinition('ForgotPasswordResponse', 'String'),
              'forgotPassword'
            )
          )
        );

        routesArray.push(
          constructRoute(
            new ConduitRoute(
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
              'resetPassword'
            )
          )
        );

        routesArray.push(
          constructRoute(
            new ConduitRoute(
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
              'changePassword'
            )
          )
        );

        routesArray.push(
          constructRoute(
            new ConduitRoute(
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
              'verifyChangePassword'
            )
          )
        );

        routesArray.push(
          constructRoute(
            new ConduitRoute(
              {
                path: '/hook/verify-email/:verificationToken',
                action: ConduitRouteActions.GET,
                description: `A webhook used to verify user email. This bypasses the need for clientid/secret`,
                urlParams: {
                  verificationToken: ConduitString.Required,
                },
              },
              new ConduitRouteReturnDefinition('VerifyEmailResponse', 'String'),
              'verifyEmail'
            )
          )
        );
      }

      if (authConfig?.twofa.enabled) {
        routesArray.push(
          constructRoute(
            new ConduitRoute(
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
              'verifyTwoFa'
            )
          )
        );

        routesArray.push(
          constructRoute(
            new ConduitRoute(
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
              'enableTwoFa'
            )
          )
        );

        routesArray.push(
          constructRoute(
            new ConduitRoute(
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
              'verifyPhoneNumber'
            )
          )
        );

        routesArray.push(
          constructRoute(
            new ConduitRoute(
              {
                path: '/local/disable-twofa',
                action: ConduitRouteActions.UPDATE,
                description: `Disables the user's 2FA mechanism.`,
                middlewares: ['authMiddleware'],
              },
              new ConduitRouteReturnDefinition('DisableTwoFaResponse', 'String'),
              'disableTwoFa'
            )
          )
        );
      }
      enabled = true;
    }
    errorMessage = null;
    authActive = await this.facebookHandlers
      .validate()
      .catch((e: any) => (errorMessage = e));
    if (!errorMessage && authActive) {
      routesArray.push(
        constructRoute(
          new ConduitRoute(
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
            'authenticateFacebook'
          )
        )
      );

      enabled = true;
    }

    errorMessage = null;
    authActive = await this.googleHandlers
      .validate()
      .catch((e: any) => (errorMessage = e));
    if (!errorMessage && authActive) {
      routesArray.push(
        constructRoute(
          new ConduitRoute(
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
            'authenticateGoogle'
          )
        )
      );

      enabled = true;
    }

    errorMessage = null;
    authActive = await this.serviceHandler
      .validate()
      .catch((e: any) => (errorMessage = e));
    if (!errorMessage && authActive) {
      routesArray.push(
        constructRoute(
          new ConduitRoute(
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
            'authenticateService'
          )
        )
      );

      enabled = true;
    }

    errorMessage = null;
    authActive = await this.kakaoHandlers
      .validate()
      .catch((e: any) => (errorMessage = e));
    if (!errorMessage && authActive) {
      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: '/hook/kakao',
              action: ConduitRouteActions.GET,
              description: `Login/register with KakaoTalk using redirection mechanism.`,
              urlParams: {
                code: ConduitString.Required,
                state: ConduitString.Required,
              },
            },
            new ConduitRouteReturnDefinition('KakaoResponse', {
              userId: ConduitString.Required,
              accessToken: ConduitString.Required,
              refreshToken: ConduitString.Required,
            }),
            'authenticateKakao'
          )
        )
      );

      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: '/init/kakao',
              description: `Begins the authentication process with KakaoTalk.`,
              action: ConduitRouteActions.GET,
            },
            new ConduitRouteReturnDefinition('KakaoInitResponse', 'String'),
            'beginAuthKakao'
          )
        )
      );

      enabled = true;
    }

    errorMessage = null;
    authActive = await this.twitchHandlers
      .validate()
      .catch((e: any) => (errorMessage = e));
    if (!errorMessage && authActive) {
      routesArray.push(
        constructRoute(
          new ConduitRoute(
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
            'authenticateTwitch'
          )
        )
      );
      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: '/init/twitch',
              description: `Begins the Twitch authentication.`,
              action: ConduitRouteActions.GET,
            },
            new ConduitRouteReturnDefinition('TwitchInitResponse', 'String'),
            'beginAuthTwitch'
          )
        )
      );
      enabled = true;
    }

    if (enabled) {
      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: '/user',
              description: `Returns the authenticated user.`,
              action: ConduitRouteActions.GET,
              middlewares: ['authMiddleware'],
            },
            new ConduitRouteReturnDefinition('User', User.getInstance().fields),
            'getUser'
          )
        )
      );
      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: '/user',
              description: `Deletes the authenticated user.`,
              action: ConduitRouteActions.DELETE,
              middlewares: ['authMiddleware'],
            },
            new ConduitRouteReturnDefinition('DeleteUserResponse', 'String'),
            'deleteUser'
          )
        )
      );
      routesArray.push(
        constructRoute(
          new ConduitRoute(
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
            'renewAuth'
          )
        )
      );

      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: '/logout',
              action: ConduitRouteActions.POST,
              middlewares: ['authMiddleware'],
            },
            new ConduitRouteReturnDefinition('LogoutResponse', 'String'),
            'logOut'
          )
        )
      );

      routesArray.push(
        constructMiddleware(new ConduitMiddleware({ path: '/' }, 'authMiddleware'))
      );
    }
    return routesArray;
  }

  async middleware(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    let context = call.request.context;
    let headers = call.request.headers;

    const header = (headers['Authorization'] || headers['authorization']) as string;
    if (isNil(header)) {
      throw new GrpcError(grpc.status.UNAUTHENTICATED, 'No authorization header present');
    }
    const args = header.split(' ');

    if (args[0] !== 'Bearer' || isNil(args[1])) {
      throw new GrpcError(grpc.status.UNAUTHENTICATED, 'Authorization header malformed');
    }

    let accessToken = await AccessToken.getInstance().findOne({
      token: args[1],
      clientId: context.clientId,
    });
    if (isNil(accessToken) || moment().isAfter(moment(accessToken.expiresOn))) {
      throw new GrpcError(
        grpc.status.UNAUTHENTICATED,
        'Token is expired or otherwise not valid'
      );
    }
    let user = await User.getInstance().findOne({
      _id: accessToken.user,
    });
    if (isNil(user)) {
      throw new GrpcError(grpc.status.UNAUTHENTICATED, 'User no longer exists');
    }
    return { user: user };
  }
}
