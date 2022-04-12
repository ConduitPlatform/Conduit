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
    private readonly commons: ConduitCommons,
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
        this.commons,
        server,
        packageDefinition,
        () => {
          Core.getInstance().httpServer.initialize();
          Core.getInstance().httpServer.start();
          this.bootstrapSdkComponents(grpcSdk).catch(console.log);
        }
      );

      this.commons.registerConfigManager(manager);
      this.commons.registerAdmin(
        new AdminModule(
          this.commons,
          grpcSdk,
          packageDefinition,
          server
        )
      );
      this.commons.registerRouter(
        new ConduitDefaultRouter(
          this.commons,
          grpcSdk,
          packageDefinition,
          server,
          Core.getInstance().httpServer.expressApp,
        )
      );
    });
  }

  private async bootstrapSdkComponents(grpcSdk: ConduitGrpcSdk) {
    await this.commons.getConfigManager().registerAppConfig();
    let error;
    this.commons
      .getConfigManager()
      .get('core')
      .catch((err: any) => (error = err));
    if (error) {
      await this.commons
        .getConfigManager()
        .registerModulesConfig('core', convict.getProperties());
    } else {
      await this.commons
        .getConfigManager()
        .addFieldsToModule('core', convict.getProperties());
    }

    this.commons.getAdmin().initialize();
    this.commons.getConfigManager().initConfigAdminRoutes();
    this.commons.registerSecurity(new SecurityModule(this.commons, grpcSdk));

    this._initialized = true;
  }
}
