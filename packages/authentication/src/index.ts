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
import { isNil, isPlainObject } from 'lodash';

class AuthenticationModule {
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

    constructor(private readonly sdk: ConduitSDK) {
       if ((sdk as any).config.get('authentication.active')) {
           this.enableModule().catch(console.log);
       }
    }

    validateConfig(configInput: any, configSchema: any = AuthenticationConfigSchema.authentication): boolean {
        if (isNil(configInput)) return false;

        return Object.keys(configInput).every(key => {
            if (configSchema.hasOwnProperty(key)) {
                if (isPlainObject(configInput[key])) {
                    return this.validateConfig(configInput[key], configSchema[key])
                } else if (configSchema[key].hasOwnProperty('format')) {
                    const format = configSchema[key].format.toLowerCase();
                    if (typeof configInput[key] === format) {
                        return true;
                    }
                }
            }
            return false;
        });
    }

    async initModule() {
        try {
            if ((this.sdk as any).config.get('authentication.active')) {
                await this.enableModule();
                return true;
            }
            throw new Error('Module is not active');
        } catch (e) {
            console.log(e);
            return false;
        }
    }

    private async enableModule() {
        this.database = this.sdk.getDatabase();
        this.emailModule = this.sdk.getEmail();
        this.conduitRouter = this.sdk.getRouter();
        this.authService = new AuthService();
        this.adminHandlers = new AdminHandlers(this.sdk);
        this.authMiddleware = new AuthMiddleware(this.sdk, this.authService);
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
