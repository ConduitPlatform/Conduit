import { ConduitCommons } from '@conduitplatform/commons';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import ConfigManager from '@conduitplatform/config';
import AdminModule from '@conduitplatform/admin';
import SecurityModule from '@conduitplatform/security';
import { ConduitDefaultRouter } from '@conduitplatform/router';
import { Server, ServerCredentials } from '@grpc/grpc-js';
import { Core } from './Core';
import path from 'path';
import convict from './utils/config';
const protoLoader = require('@grpc/proto-loader');

export class GrpcServer {
  private _initialized: boolean = false;

  get initialized() { return this._initialized; }

  constructor(
    private readonly conduitSdk: ConduitCommons,
    private readonly port: number
  ) {
    const server: Server = new Server({
      'grpc.max_receive_message_length': 1024 * 1024 * 100,
      'grpc.max_send_message_length': 1024 * 1024 * 100,
    });
    const packageDefinition = protoLoader.loadSync(
      path.resolve(__dirname, './core.proto'),
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      }
    );
    // NOTE: all core packages with gRPC need to be created before gRPC server start
    const expressApp = Core.getInstance().httpServer.expressApp;
    let _url = '0.0.0.0:' + this.port;
    server.bindAsync(_url, ServerCredentials.createInsecure(), (err, port) => {
      _url = '0.0.0.0:' + port.toString();
      const grpcSdk = new ConduitGrpcSdk(_url, 'core');
      if (err) {
        console.error(err);
        process.exit(-1);
      }
      server.start();
      console.log('gRPC server listening on:', _url);
      const manager = new ConfigManager(
        grpcSdk,
        this.conduitSdk,
        server,
        packageDefinition,
        (url: string) => {
          Core.getInstance().httpServer.postGrpcServer();
          Core.getInstance().httpServer.start();
          this.bootstrapSdkComponents(grpcSdk).catch(console.log);
        }
      );

      this.conduitSdk.registerConfigManager(manager);
      this.conduitSdk.registerAdmin(
        new AdminModule(this.conduitSdk, grpcSdk, packageDefinition, server)
      );
      this.conduitSdk.registerRouter(
        new ConduitDefaultRouter(expressApp, this.conduitSdk, grpcSdk, packageDefinition, server)
      );
    });
  }

  private async bootstrapSdkComponents(grpcSdk: ConduitGrpcSdk) {
    await this.conduitSdk.getConfigManager().registerAppConfig();
    let error;
    this.conduitSdk
      .getConfigManager()
      .get('core')
      .catch((err: any) => (error = err));
    if (error) {
      await this.conduitSdk
        .getConfigManager()
        .registerModulesConfig('core', convict.getProperties());
    } else {
      await this.conduitSdk
        .getConfigManager()
        .addFieldsToModule('core', convict.getProperties());
    }

    this.conduitSdk.getAdmin().initialize();
    this.conduitSdk.getConfigManager().initConfigAdminRoutes();
    this.conduitSdk.registerSecurity(new SecurityModule(this.conduitSdk, grpcSdk));

    this._initialized = true;
  }
}
