import { ConduitSDK, IConduitAdmin, IConduitDatabase, IConduitEmail, IConduitRouter } from '@conduit/sdk';
import * as models from './models';
import * as templates from './templates';
import { NextFunction, Request, Response, Router } from 'express';
import { LocalHandlers } from './handlers/auth/local';
import { AuthService } from './services/auth';
import { FacebookHandlers } from './handlers/auth/facebook';
import { GoogleHandlers } from './handlers/auth/google';
import { AuthMiddleware } from './middleware/auth';
import { AdminHandlers } from './handlers/admin';

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
    if (config.local.enabled) {
      if (!appConfig.get('email.active')) {
        throw new Error('Cannot use local authentication without email module being enabled');
      }
      this.authRouter.post('/local', (req: Request, res: Response, next: NextFunction) => this.localHandlers.authenticate(req, res).catch(next));
      this.authRouter.post('/local/new', (req, res, next) => this.localHandlers.register(req, res).catch(next));
      this.authRouter.post('/forgot-password', (req, res, next) => this.localHandlers.forgotPassword(req, res).catch(next));
      this.authRouter.post('/reset-password', (req, res, next) => this.localHandlers.resetPassword(req, res).catch(next));
      this.authRouter.post('/renew', (req, res, next) => this.localHandlers.renewAuth(req, res).catch(next));
      this.authRouter.post('/logout', this.authMiddleware.middleware.bind(this), (req, res, next) => this.localHandlers.logOut(req, res).catch(next));
    }

    if (config.facebook.enabled) {
      this.authRouter.post('/facebook', (req, res, next) => this.facebookHandlers.authenticate(req, res).catch(next));
    }

    if (config.google.enabled) {
      this.authRouter.post('/google', (req, res, next) => this.googleHandlers.authenticate(req, res).catch(next));
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
