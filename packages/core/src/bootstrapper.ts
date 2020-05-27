import {App} from './app';
import {ConduitApp} from './interfaces/ConduitApp';
import {Config} from 'convict';
import AdminModule from '@conduit/admin';
import SecurityModule from '@conduit/security';
import * as grpc from "grpc";
import ConfigManager from "@conduit/config";
import path from 'path';
import ConduitGrpcSdk from '@conduit/grpc-sdk';
import {ConduitDefaultRouter} from '@conduit/router';

let protoLoader = require('@grpc/proto-loader');

export class CoreBootstrapper {
    static bootstrap() {
        let primary: App;
        let _url = process.env.SERVICE_URL || '0.0.0.0:55152';

        const grpcSdk = new ConduitGrpcSdk(_url);
        var server = new grpc.Server();
        var packageDefinition = protoLoader.loadSync(
            path.resolve(__dirname, './core.proto'),
            {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true
            });
        // NOTE: all core packages with grpc need to be created before grpc server start
        primary = new App();
        const app = primary.get();

        let manager = new ConfigManager(grpcSdk, app.conduit, server, packageDefinition, (url: string) => {
            primary?.initialize();
            CoreBootstrapper.bootstrapSdkComponents(grpcSdk, app, packageDefinition, server).catch(console.log);
        });

        app.conduit.registerConfigManager(manager);
        app.conduit.registerAdmin(new AdminModule(grpcSdk, app.conduit, server, packageDefinition));
        app.conduit.registerRouter(new ConduitDefaultRouter(app, grpcSdk, packageDefinition, server));

        server.bind(_url, grpc.ServerCredentials.createInsecure());
        server.start();
        console.log("grpc server listening on:", _url);
        return app;
    }

    private static async bootstrapSdkComponents(grpcSdk: ConduitGrpcSdk, app: ConduitApp, packageDefinition: string, server: any) {
        await app.conduit.getConfigManager().registerConfigSchemas();

        const appConfig: Config<any> = (app.conduit as any).config;
        const databaseConfigUtility = app.conduit.getConfigManager().getDatabaseConfigUtility(appConfig);

        await databaseConfigUtility.configureFromDatabase();

        app.conduit.getAdmin().initialize();
        app.conduit.getConfigManager().initConfigAdminRoutes();
        app.conduit.registerSecurity(new SecurityModule(app.conduit, grpcSdk));

        app.initialized = true;
    }
}
