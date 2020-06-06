import * as models from './models';
import {AuthService} from './services/auth';
// import {AuthMiddleware} from './middleware/auth';
import {AdminHandlers} from './admin/admin';
import AuthenticationConfigSchema from './config/authentication';
import {isNil} from 'lodash';
import ConduitGrpcSdk, {grpcModule} from '@conduit/grpc-sdk';
import path from "path";
import {ConduitUtilities} from '@conduit/utilities';
import * as grpc from "grpc";
import {AuthenticationRoutes} from './routes/Routes';
import EmailConfigSchema from "../../email/src/config";

let protoLoader = require('@grpc/proto-loader');

export default class AuthenticationModule {
    private database: any;
    private authService: AuthService;
    private _admin: AdminHandlers;
    private isRunning: boolean = false;
    private _url: string;
    private readonly grpcServer: any;
    private _routes: any[];

    constructor(private readonly grpcSdk: ConduitGrpcSdk) {
        this.authService = new AuthService();

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

        this.grpcSdk.waitForExistence('database-provider')
            .then(() => {
                return this.grpcSdk.config.get('authentication')
            })
            .catch(() => {
                return this.grpcSdk.config.updateConfig(AuthenticationConfigSchema, 'authentication');
            })
            .then((authConfig: any) => {
                if (authConfig.active) {
                    return this.enableModule(authConfig);
                }
            }).catch(console.log);
    }

    get routes() {
        return this._routes;
    }

    get url(): string {
        return this._url;
    }

    async setConfig(call: any, callback: any) {
        const newConfig = JSON.parse(call.request.newConfig);
        if (!AuthenticationConfigSchema.load(newConfig).validate()) {
            return callback({code: grpc.status.INVALID_ARGUMENT, message: 'Invalid configuration values'});
        }

        let errorMessage: string | null = null;
        const updateResult = await this.grpcSdk.config.updateConfig(newConfig, 'authentication').catch((e: Error) => errorMessage = e.message);
        if (!isNil(errorMessage)) {
            return callback({code: grpc.status.INTERNAL, message: errorMessage});
        }

        const authenticationConfig = await this.grpcSdk.config.get('authentication');
        if (authenticationConfig.active) {
            await this.enableModule(authenticationConfig).catch((e: Error) => errorMessage = e.message);
        } else {
            return callback({code: grpc.status.FAILED_PRECONDITION, message: 'Module is not active'});
        }
        if (!isNil(errorMessage)) {
            return callback({code: grpc.status.INTERNAL, message: errorMessage});
        }

        return callback(null, {updatedConfig: JSON.stringify(updateResult)});
    }

    private async enableModule(authConfig: any) {
        if (!this.isRunning) {
            this.database = this.grpcSdk.databaseProvider;

            this._admin = new AdminHandlers(this.grpcServer, this.grpcSdk);
            await this.registerSchemas();

            let router = new AuthenticationRoutes(this.grpcServer, this.grpcSdk, this.authService, authConfig);
            this._routes = router.registeredRoutes;

            this.grpcServer.start();
            this.isRunning = true;
        } else {
            // TODO For now an update on the config will not influence the routes(providers) that should influence
        }
    }

    // get middleware() {
    //   return this.authMiddleware.middleware.bind(this.authMiddleware);
    // }

    private registerSchemas() {
        const promises = Object.values(models).map(model => {
            return this.database.createSchemaFromAdapter(model);
        });
        return Promise.all(promises);
    }

}
