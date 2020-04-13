import {
  ConduitRoute,
  ConduitRouteActions as Actions, ConduitRouteParameters,
  ConduitRouteReturnDefinition,
  ConduitSDK,
  IConduitAdmin,
  IConduitDatabase,
  IConduitEmail,
  IConduitRouter,
  TYPE
} from '@conduit/sdk';
import * as models from './models';
import * as templates from './templates';
import { Router } from 'express';
import { LocalHandlers } from './handlers/auth/local';
import { AuthService } from './services/auth';
import { FacebookHandlers } from './handlers/auth/facebook';
import { GoogleHandlers } from './handlers/auth/google';
import { AuthMiddleware } from './middleware/auth';
import { AdminHandlers } from './handlers/admin';
import { CommonHandlers } from './handlers/auth/common';

class AuthenticationModule {
  private readonly database: IConduitDatabase;
  private readonly emailModule: IConduitEmail;
  private readonly adminModule: IConduitAdmin;
  private readonly conduitRouter: IConduitRouter;
  private readonly authService: AuthService;
  private readonly localHandlers: LocalHandlers;
  private readonly facebookHandlers: FacebookHandlers;
  private readonly googleHandlers: GoogleHandlers;
  private readonly adminHandlers: AdminHandlers;
  private readonly commonHandlers: CommonHandlers;
  private readonly authRouter: Router;
  private readonly hookRouter: Router;
  private readonly authMiddleware: AuthMiddleware;

  constructor(
    private readonly sdk: ConduitSDK
  ) {
    this.database = sdk.getDatabase();
    this.emailModule = sdk.getEmail();
    this.adminModule = sdk.getAdmin();
    this.conduitRouter = sdk.getRouter();
    this.authService = new AuthService();
    this.localHandlers = new LocalHandlers(sdk, this.authService);
    this.facebookHandlers = new FacebookHandlers(sdk, this.authService);
    this.googleHandlers = new GoogleHandlers(sdk, this.authService);
    this.adminHandlers = new AdminHandlers(sdk);
    this.authMiddleware = new AuthMiddleware(sdk, this.authService);
    this.commonHandlers = new CommonHandlers(sdk, this.authService);
    this.authRouter = Router();
    this.hookRouter = Router();
    this.init();
  }

  get middleware() {
    return this.authMiddleware.middleware.bind(this.authMiddleware);
  }

  private registerSchemas() {
    Object.values(models).forEach(model => {
      this.database.createSchemaFromAdapter(model);
    });
  }

  private registerTemplates() {
    const promises = Object.values(templates).map(template => {
      return this.emailModule.registerTemplate(template);
    });
    Promise.all(promises).catch(console.log);
  }

  private registerAuthRoutes(config: any) {
    const { config: appConfig } = this.sdk as any;

    let enabled = false;

    const authMiddleware = this.authMiddleware.middleware.bind(this.authMiddleware);

    if (config.local.enabled) {
      if (!appConfig.get('email.active')) {
        throw new Error('Cannot use local authentication without email module being enabled');
      }

      // Login Endpoint
      this.conduitRouter.registerRoute(new ConduitRoute(
        {
          path: '/authentication/local',
          action: Actions.POST,
          queryParams: {
            email: 'String',
            password: 'String'
          }
        },
        new ConduitRouteReturnDefinition('LoginResponse', {userId: TYPE.String, accessToken: TYPE.String, refreshToken: TYPE.String}),
        (params: ConduitRouteParameters) => this.localHandlers.authenticate(params)
      ));
      // Register endpoint
      this.conduitRouter.registerRoute(new ConduitRoute(
        {
          path: '/authentication/local/new',
          action: Actions.POST,
          queryParams: {
            email: 'String',
            password: 'String'
          }
        },
        new ConduitRouteReturnDefinition('RegisterResponse', 'String'),
        (params: ConduitRouteParameters) => this.localHandlers.register(params)
      ));
      // Forgot-password endpoint
      this.conduitRouter.registerRoute(new ConduitRoute(
        {
          path: '/authentication/forgot-password',
          action: Actions.POST,
          queryParams: {
            email: 'String'
          }
        },
        new ConduitRouteReturnDefinition('ForgotPasswordResponse', 'String'),
        (params: ConduitRouteParameters) => this.localHandlers.forgotPassword(params)
      ));
      // Reset-password endpoint
      this.conduitRouter.registerRoute(new ConduitRoute(
        {
          path: '/authentication/reset-password',
          action: Actions.POST,
          queryParams: {
            passwordResetToken: 'String',
            password: 'String'
          }
        },
        new ConduitRouteReturnDefinition('ResetPasswordResponse', 'String'),
        (params: ConduitRouteParameters) => this.localHandlers.resetPassword(params)
      ));
      enabled = true;
    }

    if (config.facebook.enabled) {
      this.conduitRouter.registerRoute(new ConduitRoute(
        {
          path: '/authentication/facebook',
          action: Actions.POST,
          queryParams: {
            access_token: 'String'
          }
        },
        new ConduitRouteReturnDefinition('FacebookResponse', {userId: TYPE.String, accessToken: TYPE.String, refreshToken: TYPE.String}),
        (params: ConduitRouteParameters) => this.facebookHandlers.authenticate(params)
      ));
      enabled = true;
    }

    if (config.google.enabled) {
      this.conduitRouter.registerRoute(new ConduitRoute(
        {
          path: '/authentication/google',
          action: Actions.POST,
          queryParams: {
            id_token: 'String',
            access_token: 'String',
            refresh_token: 'String',
            expires_in: 'String'
          }
        },
        new ConduitRouteReturnDefinition('GoogleResponse', {userId: TYPE.String, accessToken: TYPE.String, refreshToken: TYPE.String}),
        (params: ConduitRouteParameters) => this.googleHandlers.authenticate(params)
      ));
      enabled = true;
    }

    if (enabled) {
      this.conduitRouter.registerRoute(new ConduitRoute(
        {
          path: '/authentication/renew',
          action: Actions.POST,
          queryParams: {
            refreshToken: 'String'
          }
        },
        new ConduitRouteReturnDefinition('RenewAuthenticationResponse', {accessToken: TYPE.String, refreshToken: TYPE.String}),
        (params: ConduitRouteParameters) => this.commonHandlers.renewAuth(params)
      ));
      // TODO authMiddleware needs to be bind in the below endpoint. It doesn't work as it is cause it needs the user in the context
      this.conduitRouter.registerRoute(new ConduitRoute(
        {
          path: '/authentication/logout',
          action: Actions.POST
        },
        new ConduitRouteReturnDefinition('Logout response', 'String'),
        (params: ConduitRouteParameters) => this.commonHandlers.logOut(params)
      ));
    }

    this.hookRouter.get('/verify-email/:verificationToken', (req, res, next) => this.localHandlers.verifyEmail(req, res).catch(next));

    this.conduitRouter.registerExpressRouter('/authentication', this.authRouter);
    this.conduitRouter.registerExpressRouter('/hook', this.hookRouter);
  }

  private registerAdminRoutes() {
    this.adminModule.registerRoute('GET', '/users', (req, res, next) => this.adminHandlers.getUsers(req, res).catch(next));

    this.adminModule.registerRoute('PUT', '/authentication/config', (req, res, next) => this.adminHandlers.editAuthConfig(req, res).catch(next));

    this.adminModule.registerRoute('GET', '/authentication/config', (req, res, next) => this.adminHandlers.getAuthConfig(req, res).catch(next));
  }

  private init() {
    this.registerSchemas();
    this.registerTemplates();
    const { config: appConfig } = this.sdk as any;
    const config = appConfig.get('authentication');
    this.registerAuthRoutes(config);
    this.registerAdminRoutes();
  }
}

export = AuthenticationModule;
