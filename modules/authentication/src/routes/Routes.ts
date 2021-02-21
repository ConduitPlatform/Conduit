import { LocalHandlers } from '../handlers/auth/local';
import * as grpc from 'grpc';
import ConduitGrpcSdk, {
  ConduitMiddleware,
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  constructMiddleware,
  constructRoute,
  GrpcServer,
  TYPE,
} from '@quintessential-sft/conduit-grpc-sdk';
import { FacebookHandlers } from '../handlers/auth/facebook';
import { GoogleHandlers } from '../handlers/auth/google';
import { CommonHandlers } from '../handlers/auth/common';
import { ServiceHandler } from '../handlers/auth/service';
import { KakaoHandlers } from '../handlers/auth/kakao';
import { TwitchHandlers } from '../handlers/auth/twitch';
import { isNil } from 'lodash';
import { UserSchema } from '../models';
import moment from 'moment';

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
      .registerRouter(this.server, activeRoutes, {
        register: this.localHandlers.register.bind(this.localHandlers),
        authenticateLocal: this.localHandlers.authenticate.bind(this.localHandlers),
        forgotPassword: this.localHandlers.forgotPassword.bind(this.localHandlers),
        resetPassword: this.localHandlers.resetPassword.bind(this.localHandlers),
        verifyEmail: this.localHandlers.verifyEmail.bind(this.localHandlers),
        verify: this.localHandlers.verify.bind(this.localHandlers),
        enableTwoFa: this.localHandlers.enableTwoFa.bind(this.localHandlers),
        verifyPhoneNumber: this.localHandlers.verifyPhoneNumber.bind(this.localHandlers),
        disableTwoFa: this.localHandlers.disableTwoFa.bind(this.localHandlers),
        authenticateFacebook: this.facebookHandlers.authenticate.bind(
          this.facebookHandlers
        ),
        authenticateGoogle: this.googleHandlers.authenticate.bind(this.googleHandlers),
        authenticateService: this.serviceHandler.authenticate.bind(this.serviceHandler),
        authenticateKakao: this.kakaoHandlers.authenticate.bind(this.kakaoHandlers),
        authenticateTwitch: this.twitchHandlers.authenticate.bind(this.twitchHandlers),
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
      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: '/authentication/local/new',
              action: ConduitRouteActions.POST,
              bodyParams: {
                email: TYPE.String,
                password: TYPE.String,
              },
            },
            new ConduitRouteReturnDefinition('RegisterResponse', 'String'),
            'register'
          )
        )
      );

      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: '/authentication/local',
              action: ConduitRouteActions.POST,
              bodyParams: {
                email: TYPE.String,
                password: TYPE.String,
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

      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: '/authentication/forgot-password',
              action: ConduitRouteActions.POST,
              bodyParams: {
                email: TYPE.String,
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
              path: '/authentication/reset-password',
              action: ConduitRouteActions.POST,
              bodyParams: {
                passwordResetToken: TYPE.String,
                password: TYPE.String,
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
              path: '/hook/authentication/verify-email/:verificationToken',
              action: ConduitRouteActions.GET,
              urlParams: {
                verificationToken: TYPE.String,
              },
            },
            new ConduitRouteReturnDefinition('VerifyEmailResponse', 'String'),
            'verifyEmail'
          )
        )
      );

      const authConfig = await this.grpcSdk.config
        .get('authentication')
        .catch(console.error);
      if (authConfig?.twofa.enabled) {
        routesArray.push(
          constructRoute(
            new ConduitRoute(
              {
                path: '/authentication/local/twofa',
                action: ConduitRouteActions.POST,
                bodyParams: {
                  email: TYPE.String,
                  code: TYPE.String,
                },
              },
              new ConduitRouteReturnDefinition('VerifyTwoFaResponse', {
                userId: ConduitString.Optional,
                accessToken: ConduitString.Optional,
                refreshToken: ConduitString.Optional,
                message: ConduitString.Optional,
              }),
              'verify'
            )
          )
        );

        routesArray.push(
          constructRoute(
            new ConduitRoute(
              {
                path: '/authentication/local/enable-twofa',
                action: ConduitRouteActions.UPDATE,
                middlewares: ['authMiddleware'],
                bodyParams: {
                  phoneNumber: TYPE.String,
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
                path: '/authentication/local/verifyPhoneNumber',
                action: ConduitRouteActions.POST,
                middlewares: ['authMiddleware'],
                bodyParams: {
                  code: TYPE.String,
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
                path: '/authentication/local/disable-twofa',
                action: ConduitRouteActions.UPDATE,
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
              path: '/authentication/facebook',
              action: ConduitRouteActions.POST,
              bodyParams: {
                // todo switch to required when the parsing is added
                access_token: ConduitString.Optional,
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
              path: '/authentication/google',
              action: ConduitRouteActions.POST,
              bodyParams: {
                id_token: TYPE.String,
                access_token: TYPE.String,
                expires_in: TYPE.String,
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
              path: '/authentication/service',
              action: ConduitRouteActions.POST,
              bodyParams: {
                serviceName: TYPE.String,
                token: TYPE.String,
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
              path: '/hook/authentication/kakao',
              action: ConduitRouteActions.GET,
              urlParams: {
                code: TYPE.String,
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
              path: '/hook/authentication/twitch',
              action: ConduitRouteActions.GET,
              urlParams: {
                code: TYPE.String,
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

      enabled = true;
    }

    if (enabled) {
      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: '/authentication/user',
              action: ConduitRouteActions.GET,
              middlewares: ['authMiddleware'],
            },
            new ConduitRouteReturnDefinition('UserResponse', UserSchema.fields),
            'getUser'
          )
        )
      );
      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: '/authentication/user',
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
              path: '/authentication/renew',
              action: ConduitRouteActions.POST,
              bodyParams: {
                refreshToken: TYPE.String,
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
              path: '/authentication/logout',
              action: ConduitRouteActions.POST,
              middlewares: ['authMiddleware'],
            },
            new ConduitRouteReturnDefinition('LogoutResponse', 'String'),
            'logOut'
          )
        )
      );

      routesArray.push(
        constructMiddleware(
          new ConduitMiddleware({ path: '/authentication' }, 'authMiddleware')
        )
      );
    }
    return routesArray;
  }

  middleware(call: any, callback: any) {
    let context = JSON.parse(call.request.context);
    let headers = JSON.parse(call.request.headers);

    const header = (headers['Authorization'] || headers['authorization']) as string;
    if (isNil(header)) {
      return callback({
        code: grpc.status.UNAUTHENTICATED,
        message: 'No authorization header present',
      });
    }
    const args = header.split(' ');

    if (args[0] !== 'Bearer' || isNil(args[1])) {
      return callback({
        code: grpc.status.UNAUTHENTICATED,
        message: 'Authorization header malformed',
      });
    }

    this.grpcSdk
      .databaseProvider!.findOne('AccessToken', {
        token: args[1],
        clientId: context.clientId,
      })
      .then((accessTokenDoc: any) => {
        if (isNil(accessTokenDoc) || moment().isAfter(moment(accessTokenDoc.expiresOn))) {
          return callback({
            code: grpc.status.UNAUTHENTICATED,
            message: 'Token is expired or otherwise not valid',
          });
        }
        return this.grpcSdk
          .databaseProvider!.findOne('User', { _id: accessTokenDoc.userId })
          .then((user: any) => {
            if (isNil(user)) {
              callback({
                code: grpc.status.UNAUTHENTICATED,
                message: 'User no longer exists',
              });
            } else {
              callback(null, { result: JSON.stringify({ user: user }) });
            }
          });
      })
      .catch((err) => {
        callback({
          code: grpc.status.INTERNAL,
          message: err?.message ? err.message : 'Something went wrong',
        });
      });
  }
}
