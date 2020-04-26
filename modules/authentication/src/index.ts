import {
    ConduitError,
    ConduitSDK,
    IConduitAuthentication,
    IConduitDatabase,
    IConduitEmail,
    IConduitRouter
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
import {isNil} from 'lodash';

export default class AuthenticationModule implements IConduitAuthentication {
    private database: IConduitDatabase;
    private emailModule: IConduitEmail;
    private conduitRouter: IConduitRouter;
    private authService: AuthService;
    private adminHandlers: AdminHandlers;
    private hookRouter: Router;
    private authMiddleware: AuthMiddleware;
    private commonHandlers: CommonHandlers;
    private localHandlers: LocalHandlers;
    private facebookHandlers: FacebookHandlers;
    private googleHandlers: GoogleHandlers;
    private isRunning: boolean = false;

    constructor(private readonly sdk: ConduitSDK) {
        if ((sdk as any).config.get('authentication.active')) {
            this.enableModule().catch(console.log);
        }
    }

    async setConfig(newConfig: any) {
        if (!ConduitSDK.validateConfig(newConfig, AuthenticationConfigSchema.authentication)) {
            throw new Error('Invalid configuration values');
        }

        let errorMessage: string | null = null;
        const updateResult = await this.sdk.updateConfig(newConfig, 'authentication').catch((e: Error) => errorMessage = e.message);
        if (!isNil(errorMessage)) {
            throw new Error(errorMessage);
        }

        if ((this.sdk as any).config.get('authentication.active')) {
            await this.enableModule().catch((e: Error) => errorMessage = e.message);
        } else {
            throw new Error('Module is not active');
        }
        if (!isNil(errorMessage)) {
            throw new Error(errorMessage);
        }

        return updateResult;
    }

    private async enableModule() {
        if (!this.isRunning) {
            this.database = this.sdk.getDatabase();
            this.emailModule = this.sdk.getEmail();
            this.conduitRouter = this.sdk.getRouter();
            this.authService = new AuthService();
            this.adminHandlers = new AdminHandlers(this.sdk);
            this.authMiddleware = new AuthMiddleware(this.sdk, this.authService);
            this.hookRouter = Router();
            this.registerSchemas();
            const {config: appConfig} = this.sdk as any;
            const config = appConfig.get('authentication');
            this.registerAuthRoutes(config);
            this.isRunning = true;
        } else {
            // TODO For now an update on the config will not influence the routes(providers) that should influence
        }
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
            this.registerTemplates();
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
