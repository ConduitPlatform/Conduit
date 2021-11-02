import ConduitGrpcSdk, {
  ConduitServiceModule,
  GrpcServer,
  SetConfigRequest,
  SetConfigResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import ChatConfigSchema from './config';
import { status } from '@grpc/grpc-js';
import path from 'path';
import { isNil } from 'lodash';
import { ChatRoutes } from './routes/Routes';
import * as models from './models';
import { AdminHandlers } from './admin/admin';

export default class ChatModule implements ConduitServiceModule {
  private database: any;
  private _admin: AdminHandlers;
  private isRunning: boolean = false;
  private grpcServer: GrpcServer;
  private _router: ChatRoutes;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  private _port: string;

  get port(): string {
    return this._port;
  }

  async initialize() {
    this.grpcServer = new GrpcServer(process.env.SERVICE_URL);
    this._port = (await this.grpcServer.createNewServer()).toString();
    await this.grpcServer.addService(
      path.resolve(__dirname, './chat.proto'),
      'chat.Chat',
      {
        setConfig: this.setConfig.bind(this),
      }
    );
    await this.grpcServer.start();
  }

  async activate() {
    await this.grpcSdk.waitForExistence('database-provider');
    await this.grpcSdk.initializeEventBus();
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
    try {
      await this.grpcSdk.config.get('chat');
    } catch (e) {
      await this.grpcSdk.config.updateConfig(ChatConfigSchema.getProperties(), 'chat');
    }
    let config = await this.grpcSdk.config.addFieldstoConfig(
      ChatConfigSchema.getProperties(),
      'chat'
    );
    if (config.active) await this.enableModule();
  }

  async setConfig(call: SetConfigRequest, callback: SetConfigResponse) {
    const newConfig = JSON.parse(call.request.newConfig);
    try {
      ChatConfigSchema.load(newConfig).validate();
    } catch (e) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Module is not active',
      });
    }

    let errorMessage: string | null = null;
    const updateResult = await this.grpcSdk.config
      .updateConfig(newConfig, 'chat')
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    const chatConfig = await this.grpcSdk.config.get('chat');
    if (chatConfig.active) {
      await this.enableModule().catch((e: Error) => (errorMessage = e.message));
      if (!isNil(errorMessage)) {
        return callback({ code: status.INTERNAL, message: errorMessage });
      }
      this.grpcSdk.bus?.publish('chat', 'config-update');
    } else {
      return callback({
        code: status.FAILED_PRECONDITION,
        message: 'Module is not active',
      });
    }
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    return callback(null, { updatedConfig: JSON.stringify(updateResult) });
  }

  private async enableModule() {
    if (!this.isRunning) {
      this.database = this.grpcSdk.databaseProvider;
      this._router = new ChatRoutes(this.grpcServer, this.grpcSdk);
      this._admin = new AdminHandlers(this.grpcServer, this.grpcSdk);
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
