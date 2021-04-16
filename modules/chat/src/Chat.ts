import ConduitGrpcSdk, { GrpcServer, SetConfigRequest, SetConfigResponse } from '@quintessential-sft/conduit-grpc-sdk';
import ChatConfigSchema from './config';
import * as grpc from 'grpc';
import path from 'path';
import { isNil } from 'lodash';
import { ChatRoutes } from './routes/Routes';
import * as models from './models';

export default class ChatModule {
  private database: any;
  private isRunning: boolean = false;
  private _url: string;
  private readonly grpcServer: GrpcServer;
  private _router: ChatRoutes;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.grpcServer = new GrpcServer(process.env.SERVICE_URL);
    this._url = this.grpcServer.url;
    this.grpcServer
      .addService(path.resolve(__dirname, './chat.proto'), 'chat.Chat', {
        setConfig: this.setConfig.bind(this),
      })
      .then(() => {
        return this.grpcServer.start();
      })
      .then(() => {
        console.log('Grpc server is online');
      })
      .catch((err: Error) => {
        console.log('Failed to initialize server');
        console.error(err);
        process.exit(-1);
      });

    this.grpcSdk
      .waitForExistence('database-provider')
      .then(() => {
        return this.grpcSdk.initializeEventBus();
      })
      .then(() => {
        this.grpcSdk.bus?.subscribe('chat', (message: string) => {
          if (message === 'config-update') {
            this.enableModule()
              .then(() => {
                console.log('Updated chat configuration');
              })
              .catch(() => {
                console.log('Failed to update chat config');
              });
          }
        });
      })
      .catch(() => {
        console.log('Bus did not initialize!');
      })
      .then(() => {
        return this.grpcSdk.config.get('chat');
      })
      .catch(() => {
        return this.grpcSdk.config.updateConfig(ChatConfigSchema.getProperties(), 'chat');
      })
      .then(() => {
        return this.grpcSdk.config.addFieldstoConfig(
          ChatConfigSchema.getProperties(),
          'chat'
        );
      })
      .catch(() => {
        console.log('chat config did not update');
      })
      .then((chatConfig: any) => {
        if (chatConfig.active) {
          return this.enableModule();
        }
      })
      .catch(console.log);
  }

  get url(): string {
    return this._url;
  }

  async setConfig(call: SetConfigRequest, callback: SetConfigResponse) {
    const newConfig = JSON.parse(call.request.newConfig);
    if (!ChatConfigSchema.load(newConfig).validate()) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Module is not active'
      });
    }

    let errorMessage: string | null = null;
    const updateResult = await this.grpcSdk.config
      .updateConfig(newConfig, 'chat')
      .catch(((e: Error) => (errorMessage = e.message)));
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    const chatConfig = await this.grpcSdk.config.get('chat');
    if (chatConfig.active) {
      await this.enableModule().catch((e: Error) => (errorMessage = e.message));
      if (!isNil(errorMessage)) {
        return callback({ code: grpc.status.INTERNAL, message: errorMessage });
      }
      this.grpcSdk.bus?.publish('chat', 'config-update');
    } else {
      return callback({
        code: grpc.status.FAILED_PRECONDITION,
        message:'Module is not active'
      });
    }
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    return callback(null, { updatedConfig: JSON.stringify(updateResult) });
  }

  private async enableModule() {
    if (!this.isRunning) {
      this.database = this.grpcSdk.databaseProvider;
      this._router = new ChatRoutes(this.grpcServer, this.grpcSdk);
      await this.registerSchemas();
      this.isRunning = true;
    }

    await this._router.registerRoutes();
  }

  private registerSchemas() {
    const promises = Object.values(models).map((model) => {
      return this.database.createSchemaFromAdapter(model);
    });

    return Promise.all(promises);
  }
}
