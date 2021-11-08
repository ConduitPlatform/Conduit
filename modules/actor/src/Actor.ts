import * as models from './models';
import { AdminHandlers } from './admin/admin';
import ActorConfigSchema from './config';
import { isNil } from 'lodash';
import {
  ConduitServiceModule,
  GrpcServer,
  SetConfigRequest,
  SetConfigResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import path from 'path';
import { status } from '@grpc/grpc-js';

export default class ActorModule extends ConduitServiceModule {
  private database: any;
  private _admin: AdminHandlers;
  private isRunning: boolean = false;

  async initialize() {
    this.grpcServer = new GrpcServer(process.env.SERVICE_URL);
    this._port = (await this.grpcServer.createNewServer()).toString();
    await this.grpcServer.addService(
      path.resolve(__dirname, './actor.proto'),
      'actor.Actor',
      {
        setConfig: this.setConfig.bind(this),
      }
    );
    this.grpcServer.start();
    console.log('Grpc server is online');
  }

  async activate() {
    await this.grpcSdk.waitForExistence('database-provider');
    await this.grpcSdk.initializeEventBus();
    await this.grpcSdk.bus?.subscribe('actor', (message: string) => {
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
    try {
      await this.grpcSdk.config.get('actor');
    } catch (e) {
      await this.grpcSdk.config.updateConfig(ActorConfigSchema.getProperties(), 'actor');
    }
    let config = await this.grpcSdk.config.addFieldstoConfig(
      ActorConfigSchema.getProperties(),
      'actor'
    );
    if (config.active) {
      return this.enableModule();
    }
  }

  async setConfig(call: SetConfigRequest, callback: SetConfigResponse) {
    const newConfig = JSON.parse(call.request.newConfig);
    if (!ActorConfigSchema.load(newConfig).validate()) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Invalid configuration values',
      });
    }

    let errorMessage: string | null = null;
    const updateResult = await this.grpcSdk.config
      .updateConfig(newConfig, 'actor')
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    const actorConfig = await this.grpcSdk.config.get('actor');
    if (actorConfig.active) {
      await this.enableModule().catch((e: Error) => (errorMessage = e.message));
      if (!isNil(errorMessage))
        return callback({ code: status.INTERNAL, message: errorMessage });
      this.grpcSdk.bus?.publish('actor', 'config-update');
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
      this._admin = new AdminHandlers(this.grpcServer, this.grpcSdk);
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
