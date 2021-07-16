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
  GrpcServer,
  RouterRequest,
  RouterResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import { FacebookHandlers } from '../handlers/facebook';
import { GoogleHandlers } from '../handlers/google';
import { CommonHandlers } from '../handlers/common';
import { ServiceHandler } from '../handlers/service';
import { KakaoHandlers } from '../handlers/kakao';
import { TwitchHandlers } from '../handlers/twitch';
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
              path: '/google',
              action: ConduitRouteActions.POST,
              bodyParams: {
                id_token: ConduitString.Required,
                access_token: ConduitString.Required,
                expires_in: ConduitString.Required,
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
              action: ConduitRouteActions.GET,
              middlewares: ['authMiddleware'],
            },
            new ConduitRouteReturnDefinition('User', UserSchema.fields),
            'getUser'
          )
        )
      );
      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: '/user',
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

  async middleware(call: RouterRequest, callback: RouterResponse) {
    let context;
    let headers;
    try {
      context = JSON.parse(call.request.context);
      headers = JSON.parse(call.request.headers);
    } catch (e) {
      console.log('Failed to parse json');
      return callback({
        code: grpc.status.UNAUTHENTICATED,
        message: 'No authorization header present',
      });
    }

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
