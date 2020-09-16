import * as models from './models';
// import {AuthMiddleware} from './middleware/auth';
import {AdminHandlers} from './admin/admin';
import AuthenticationConfigSchema from './config';
import {isNil} from 'lodash';
import ConduitGrpcSdk, {grpcModule} from '@quintessential-sft/conduit-grpc-sdk';
import path from "path";
import * as grpc from "grpc";
import {AuthenticationRoutes} from './routes/Routes';

let protoLoader = require('@grpc/proto-loader');

export default class AuthenticationModule {
    private database: any;
    private _admin: AdminHandlers;
    private isRunning: boolean = false;
    private _url: string;
    private _router: AuthenticationRoutes;
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

        this.grpcSdk.waitForExistence('database-provider')
            .then(() => {
                return this.grpcSdk.config.get('authentication')
            })
            .catch(() => {
                return this.grpcSdk.config.updateConfig(AuthenticationConfigSchema.getProperties(), 'authentication');
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
            this._admin = new AdminHandlers(this.grpcServer, this.grpcSdk);
            await this.registerSchemas();
            this._router = new AuthenticationRoutes(this.grpcServer, this.grpcSdk);
            this.grpcServer.start();
            this.isRunning = true;
        }
        let url = this._url;
        if(process.env.REGISTER_NAME){
            url = 'authentication:'+this._url.split(':')[1];
        }
        await this._router.registerRoutes(url)
    }

    private registerSchemas() {
        const promises = Object.values(models).map(model => {
            return this.database.createSchemaFromAdapter(model);
        });
        return Promise.all(promises);
    }

}
