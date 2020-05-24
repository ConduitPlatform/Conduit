import * as models from './models';
import * as templates from './templates';
import {Router} from 'express';
import {LocalHandlers} from './handlers/auth/local';
import {AuthService} from './services/auth';
import {FacebookHandlers} from './handlers/auth/facebook';
import {GoogleHandlers} from './handlers/auth/google';
// import {AuthMiddleware} from './middleware/auth';
import {AdminHandlers} from './admin/admin';
import {CommonHandlers} from './handlers/auth/common';
import AuthenticationConfigSchema from './config/authentication';
import {isNil} from 'lodash';
import ConduitGrpcSdk, {grpcModule} from '@conduit/grpc-sdk';
import path from "path";
import {ConduitUtilities} from '@conduit/utilities';
import * as grpc from "grpc";

let protoLoader = require('@grpc/proto-loader');

export default class AuthenticationModule {
    private database: any;
    private emailModule: any;
    // private conduitRouter: IConduitRouter;
    private authService: AuthService;
    private _admin: AdminHandlers;
    // private hookRouter: Router;
    // private authMiddleware: AuthMiddleware;
    // private commonHandlers: CommonHandlers;
    // private localHandlers: LocalHandlers;
    // private facebookHandlers: FacebookHandlers;
    // private googleHandlers: GoogleHandlers;
    private isRunning: boolean = false;
    private _url: string;
    private readonly grpcServer: any;

    constructor(private readonly grpcSdk: ConduitGrpcSdk) {
        const packageDefinition = protoLoader.loadSync(
            path.resolve(__dirname, './authentication.proto'),
            {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true
            });
        const protoDescriptor = grpcModule.loadPackageDefinition(packageDefinition);

        const authentication = protoDescriptor.authentication.Authentication;
        this.grpcServer = new grpcModule.Server();

        this.grpcServer.addService(authentication.service, {
            setConfig: this.setConfig.bind(this)
        });
        this._url = process.env.SERVICE_URL || '0.0.0.0:0';
        let result = this.grpcServer.bind(this._url, grpcModule.ServerCredentials.createInsecure());
        this._url = process.env.SERVICE_URL || ('0.0.0.0:' + result);
        console.log("bound on:", this._url);
        this.grpcServer.start();

        this.grpcSdk.waitForExistence('database-provider')
            .then(() => {
                return this.grpcSdk.config.get('authentication')
            })
            .then((authConfig: any) => {
                if (authConfig.active) {
                    return this.enableModule();
                }
            }).catch(console.log);
    }

    get url(): string {
        return this._url;
    }

    async setConfig(call: any, callback: any) {
        const newConfig = JSON.parse(call.request.newConfig);
        if (!ConduitUtilities.validateConfigFields(newConfig, AuthenticationConfigSchema.authentication)) {
            return callback({code: grpc.status.INVALID_ARGUMENT, message: 'Invalid configuration values'});
        }

        let errorMessage: string | null = null;
        const updateResult = await this.grpcSdk.config.updateConfig(newConfig, 'authentication').catch((e: Error) => errorMessage = e.message);
        if (!isNil(errorMessage)) {
            return callback({code: grpc.status.INTERNAL, message: errorMessage});
        }

        const authenticationConfig = await this.grpcSdk.config.get('authentication');
        if (authenticationConfig.active) {
            await this.enableModule().catch((e: Error) => errorMessage = e.message);
        } else {
            return callback({code: grpc.status.FAILED_PRECONDITION, message: 'Module is not active'});
        }
        if (!isNil(errorMessage)) {
            return callback({code: grpc.status.INTERNAL, message: errorMessage});
        }

        return callback(null, {updatedConfig: JSON.stringify(updateResult)});
    }

    private async enableModule() {
        if (!this.isRunning) {
            this.database = this.grpcSdk.databaseProvider;
            this.emailModule = this.grpcSdk.emailProvider;
            // this.conduitRouter = this.sdk.getRouter();
            this.authService = new AuthService();
            this._admin = new AdminHandlers(this.grpcServer, this.grpcSdk);
            // this.authMiddleware = new AuthMiddleware(this.grpcSdk);
            // this.hookRouter = Router();
            this.registerSchemas();
            const config = this.grpcSdk.config.get('authentication');
            // this.registerAuthRoutes(config);
            this.isRunning = true;
        } else {
            // TODO For now an update on the config will not influence the routes(providers) that should influence
        }
    }

    // get middleware() {
    //   return this.authMiddleware.middleware.bind(this.authMiddleware);
    // }

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

    // private registerAuthRoutes(config: any) {
    //   const {config: appConfig} = this.sdk as any;
    //
    //   let enabled = false;
    //
    //   const authMiddleware = this.authMiddleware.middleware.bind(this.authMiddleware);
    //
    //   if (config.local.enabled) {
    //     if (!appConfig.get('email.active')) {
    //       throw ConduitError.forbidden('Cannot use local authentication without email module being enabled');
    //     }
    //     this.registerTemplates();
    //     this.localHandlers = new LocalHandlers(this.sdk, this.authService);
    //     enabled = true;
    //   }
    //
    //   if (config.facebook.enabled) {
    //     this.facebookHandlers = new FacebookHandlers(this.sdk, this.authService);
    //     enabled = true;
    //   }
    //
    //   if (config.google.enabled) {
    //     this.googleHandlers = new GoogleHandlers(this.sdk, this.authService);
    //     enabled = true;
    //   }
    //
    //   if (enabled) {
    //     this.commonHandlers = new CommonHandlers(this.sdk, this.authService);
    //     this.conduitRouter.registerRouteMiddleware('/authentication/logout', authMiddleware);
    //   }
    //
    //   this.hookRouter.get('/verify-email/:verificationToken', (req, res, next) => this.localHandlers.verifyEmail(req, res).catch(next));
    //
    //   this.conduitRouter.registerExpressRouter('/hook', this.hookRouter);
    // }
}
