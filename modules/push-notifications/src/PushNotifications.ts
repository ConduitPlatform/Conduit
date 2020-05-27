import {IPushNotificationsProvider} from './interfaces/IPushNotificationsProvider';
import {IFirebaseSettings} from './interfaces/IFirebaseSettings';
import {FirebaseProvider} from './providers/firebase';
import PushNotificationsConfigSchema from './config/push-notifications';
import {isNil} from 'lodash';
import path from 'path';
import ConduitGrpcSdk, {grpcModule} from '@conduit/grpc-sdk';
import {ConduitUtilities} from '@conduit/utilities';
import * as grpc from 'grpc';
import {AdminHandler} from './admin/admin';
import {PushNotificationsRoutes} from './routes/Routes';
import * as models from './models';

let protoLoader = require('@grpc/proto-loader');

export default class PushNotificationsModule {

    private _provider: IPushNotificationsProvider | undefined;
    private isRunning: boolean = false;
    private readonly grpcServer: any;
    private _url: string;
    // @ts-ignore
    private adminHandler: AdminHandler;
    private _routes: any[];

    constructor(private readonly grpcSdk: ConduitGrpcSdk) {
        let packageDefinition = protoLoader.loadSync(
            path.resolve(__dirname, './push-notifications.proto'),
            {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true
            });
        let protoDescriptor = grpcModule.loadPackageDefinition(packageDefinition);
        let notifications = protoDescriptor.pushnotifications.PushNotifications;
        this.grpcServer = new grpcModule.Server();

        this.grpcServer.addService(notifications.service, {
            setConfig: this.setConfig.bind(this),
            setNotificationToken: this.setNotificationToken.bind(this),
            getNotificationTokens: this.getNotificationTokens.bind(this)
        });
        let router = new PushNotificationsRoutes(this.grpcServer, this.grpcSdk);
        this._routes = router.registeredRoutes;

        this._url = process.env.SERVICE_URL || '0.0.0.0:0';
        let result = this.grpcServer.bind(this._url, grpcModule.ServerCredentials.createInsecure());
        this._url = process.env.SERVICE_URL || ('0.0.0.0:' + result);


        this.grpcSdk.waitForExistence('database-provider')
            .then(() => {
                return this.grpcSdk.config.get('pushNotifications')
            })
            .then((notificationsConfig: any) => {
                if (notificationsConfig.active) {
                    return this.enableModule()
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

        if (!ConduitUtilities.validateConfigFields(newConfig, PushNotificationsConfigSchema.pushNotifications)) {
            return callback({code: grpc.status.INVALID_ARGUMENT, message: 'Invalid configuration values'});
        }

        let errorMessage: string | null = null;
        const updateResult = await this.grpcSdk.config.updateConfig(newConfig, 'pushNotifications').catch((e: Error) => errorMessage = e.message);
        if (!isNil(errorMessage)) {
            throw new Error(errorMessage);
        }

        const notificationsConfig = await this.grpcSdk.config.get('pushNotifications');
        if (notificationsConfig.active) {
            await this.enableModule().catch((e: Error) => errorMessage = e.message);
        } else {
            return callback({code: grpc.status.FAILED_PRECONDITION, message: 'Module is not active'});
        }
        if (!isNil(errorMessage)) {
            return callback({code: grpc.status.INTERNAL, message: errorMessage});
        }

        return callback(null, {updatedConfig: JSON.stringify(updateResult)});
    }

    async setNotificationToken(call: any, callback: any) {
        const {token, platform} = JSON.parse(call.request.params);
        const {userId} = JSON.parse(call.request.context);

        let errorMessage: any = null;
        this.grpcSdk.databaseProvider!.findOne('NotificationToken', {userId, platform}).then(oldToken => {
            if (!isNil(oldToken)) return this.grpcSdk.databaseProvider!.deleteOne('NotificationToken', oldToken);
        })
            .catch(e => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        const newTokenDocument = await this.grpcSdk.databaseProvider!.create('NotificationToken', {
            userId,
            token,
            platform
        }).catch(e => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        return callback(null, {newTokenDocument: JSON.stringify(newTokenDocument)});
    }

    async getNotificationTokens(call: any, callback: any) {
        const userId = JSON.parse(call.request.params).userId;

        let errorMessage = null;
        const tokenDocuments = await this.grpcSdk.databaseProvider!.findMany('NotificationToken', {userId})
            .catch(e => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        return callback(null, {tokenDocuments: JSON.stringify(tokenDocuments)});
    }

    private async enableModule() {
        if (!this.isRunning) {
            await this.initProvider();
            await this.registerSchemas();
            this.adminHandler = new AdminHandler(this.grpcServer, this.grpcSdk, this._provider!);
            console.log("bound on:", this._url);
            this.grpcServer.start();
            this.isRunning = true;
        } else {
            await this.initProvider();
            this.adminHandler.updateProvider(this._provider!);
        }
    }

    private async initProvider() {
        const notificationsConfig = await this.grpcSdk.config.get('pushNotifications');
        const name = notificationsConfig.providerName;
        const settings = notificationsConfig[name];

        if (name === 'firebase') {
            this._provider = new FirebaseProvider(settings as IFirebaseSettings);
        } else {
            // this was done just for now so that we surely initialize the _provider variable
            this._provider = new FirebaseProvider(settings as IFirebaseSettings);
        }
    }

    private registerSchemas() {
        const promises = Object.values(models).map(model => {
            return this.grpcSdk.databaseProvider!.createSchemaFromAdapter(model);
        });
        return Promise.all(promises);
    }

}
