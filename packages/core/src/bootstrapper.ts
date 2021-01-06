import {App} from './app';
import {ConduitApp} from './interfaces/ConduitApp';
import AdminModule from '@quintessential-sft/conduit-admin';
import SecurityModule from '@quintessential-sft/conduit-security';
import * as grpc from "grpc";
import ConfigManager from '@quintessential-sft/conduit-config';
import path from 'path';
import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import {ConduitDefaultRouter} from '@quintessential-sft/conduit-router';
import convict from "./utils/config";

let protoLoader = require('@grpc/proto-loader');

export class CoreBootstrapper {
    static bootstrap() {
        let primary: App;
        let _url = process.env.SERVICE_URL || '0.0.0.0:55152';

        const grpcSdk = new ConduitGrpcSdk(_url, 'core');
        var server: grpc.Server = new grpc.Server();
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

        //@ts-ignore
        server.bind(_url, grpc.ServerCredentials.createInsecure(), {
            "grpc.max_receive_message_length": 1024 * 1024 * 100,
            "grpc.max_send_message_length": 1024 * 1024 * 100
          });
        server.start();
        console.log("grpc server listening on:", _url);
        return app;
    }

    private static async bootstrapSdkComponents(grpcSdk: ConduitGrpcSdk, app: ConduitApp, packageDefinition: string, server: any) {
        await app.conduit.getConfigManager().registerAppConfig();
        await app.conduit.getConfigManager().registerModulesConfig('core', convict.getProperties());
        //
        // const appConfig: Config<any> = (app.conduit as any).config;
        // const databaseConfigUtility = app.conduit.getConfigManager().getDatabaseConfigUtility(appConfig);

        // await databaseConfigUtility.configureFromDatabase();

        app.conduit.getAdmin().initialize();
        app.conduit.getConfigManager().initConfigAdminRoutes();
        app.conduit.registerSecurity(new SecurityModule(app.conduit, grpcSdk));

        app.initialized = true;
    }
}
