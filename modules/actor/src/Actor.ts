import * as models from './models';
import { AdminHandlers } from './admin/admin';
import ActorConfigSchema from './config';
import { isNil } from 'lodash';
import ConduitGrpcSdk, {
  GrpcServer,
  SetConfigRequest,
  SetConfigResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import path from 'path';
import * as grpc from 'grpc';
import { ActorRoutes } from './routes/Routes';
import { ExecutorController } from './controllers/executor.controller';

export default class ActorModule {
  private database: any;
  private _admin: AdminHandlers;
  private isRunning: boolean = false;
  private _url: string;
  private _router: ActorRoutes;
  private _executorController: ExecutorController;
  private readonly grpcServer: GrpcServer;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.grpcServer = new GrpcServer(process.env.SERVICE_URL);
    this._url = this.grpcServer.url;
    this.grpcServer
      .addService(path.resolve(__dirname, './actor.proto'), 'actor.Actor', {
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
        this.grpcSdk.bus?.subscribe('actor', (message: string) => {
          if (message === 'config-update') {
            this.enableModule()
              .then(() => {
                console.log('Updated actor configuration');
              })
              .catch(() => {
                console.log('Failed to update actor config');
              });
          }
        });
      })
      .catch(() => {
        console.log('Bus did not initialize!');
      })
      .then(() => {
        return this.grpcSdk.config.get('actors');
      })
      .catch(() => {
        return this.grpcSdk.config.updateConfig(
          ActorConfigSchema.getProperties(),
          'actors'
        );
      })
      .then(() => {
        return this.grpcSdk.config.addFieldstoConfig(
          ActorConfigSchema.getProperties(),
          'actors'
        );
      })
      .catch(() => {
        console.log('Actor config did not update');
      })
      .then((formsConfig: any) => {
        if (formsConfig.active) {
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
    if (!ActorConfigSchema.load(newConfig).validate()) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Invalid configuration values',
      });
    }

    let errorMessage: string | null = null;
    const updateResult = await this.grpcSdk.config
      .updateConfig(newConfig, 'actors')
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    const formsConfig = await this.grpcSdk.config.get('actors');
    if (formsConfig.active) {
      await this.enableModule().catch((e: Error) => (errorMessage = e.message));
      if (!isNil(errorMessage))
        return callback({ code: grpc.status.INTERNAL, message: errorMessage });
      this.grpcSdk.bus?.publish('actors', 'config-update');
    } else {
      return callback({
        code: grpc.status.FAILED_PRECONDITION,
        message: 'Module is not active',
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
      this._router = new ActorRoutes(this.grpcServer, this.grpcSdk);
      this._executorController = new ExecutorController(this.grpcSdk, this._router);
      this._admin = new AdminHandlers(
        this.grpcServer,
        this.grpcSdk,
        this._executorController
      );
      await this.registerSchemas();
      this.isRunning = true;
    }
  }

  private registerSchemas() {
    const promises = Object.values(models).map((model) => {
      return this.database.createSchemaFromAdapter(model);
    });
    return Promise.all(promises);
  }
}
