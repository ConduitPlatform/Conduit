import {
    ConduitSDK,
    IConduitDatabase,
    IConduitEmail,
    IConduitRouter,
    ConduitError
} from '@conduit/sdk';
import * as models from './models';
import * as templates from './templates';
import {Router} from 'express';
import {LocalHandlers} from './handlers/auth/local';
import {AuthService} from './services/auth';
import {FacebookHandlers} from './handlers/auth/facebook';
import {GoogleHandlers} from './handlers/auth/google';
import {AuthMiddleware} from './middleware/auth';
import {AdminHandlers} from './handlers/admin';
import {CommonHandlers} from './handlers/auth/common';
import AuthenticationConfigSchema from './config/authentication';

class AuthenticationModule {
    private readonly database: IConduitDatabase;
    private readonly emailModule: IConduitEmail;
    private readonly conduitRouter: IConduitRouter;
    private readonly authService: AuthService;
    private readonly adminHandlers: AdminHandlers;
    private readonly hookRouter: Router;
    private readonly authMiddleware: AuthMiddleware;
    private commonHandlers: CommonHandlers;
    private localHandlers: LocalHandlers;
    private facebookHandlers: FacebookHandlers;
    private googleHandlers: GoogleHandlers;

    constructor(private readonly sdk: ConduitSDK) {
        this.database = sdk.getDatabase();
        this.emailModule = sdk.getEmail();
        this.conduitRouter = sdk.getRouter();
        this.authService = new AuthService();
        this.adminHandlers = new AdminHandlers(sdk);
        this.authMiddleware = new AuthMiddleware(sdk, this.authService);
        this.hookRouter = Router();
        this.registerSchemas();
        this.registerTemplates();
        const {config: appConfig} = this.sdk as any;
        const config = appConfig.get('authentication');
        this.registerAuthRoutes(config);
    }

    get middleware() {
        return this.authMiddleware.middleware.bind(this.authMiddleware);
    }

    static get config() {
        return AuthenticationConfigSchema;
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
        const {config: appConfig} = this.sdk as any;

        let enabled = false;

        const authMiddleware = this.authMiddleware.middleware.bind(this.authMiddleware);

        if (config.local.enabled) {
            if (!appConfig.get('email.active')) {
                throw ConduitError.forbidden('Cannot use local authentication without email module being enabled');
            }
            this.localHandlers = new LocalHandlers(this.sdk, this.authService);
            enabled = true;
        }

        if (config.facebook.enabled) {
            this.facebookHandlers = new FacebookHandlers(this.sdk, this.authService);
            enabled = true;
        }

        if (config.google.enabled) {
            this.googleHandlers = new GoogleHandlers(this.sdk, this.authService);
            enabled = true;
        }

        if (enabled) {
            this.commonHandlers = new CommonHandlers(this.sdk, this.authService);
            this.conduitRouter.registerRouteMiddleware('/authentication/logout', authMiddleware);
        }

        this.hookRouter.get('/verify-email/:verificationToken', (req, res, next) => this.localHandlers.verifyEmail(req, res).catch(next));

        this.conduitRouter.registerExpressRouter('/hook', this.hookRouter);
    }
}

export = AuthenticationModule;
