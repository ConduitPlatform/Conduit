import { ConduitError } from '@conduitplatform/grpc-sdk';
import { GrpcServer } from './GrpcServer.js';
import { isNil } from 'lodash-es';
import AppConfigSchema, { Config as ConfigSchema } from './config/index.js';
import convict from 'convict';

export class Core {
  private static _instance: Core;
  readonly config: convict.Config<ConfigSchema> = convict(AppConfigSchema);
  private readonly _grpcServer: GrpcServer;
  private configManager: any;

  private constructor(grpcPort: number) {
    this._grpcServer = new GrpcServer(this, grpcPort);
  }

  get grpcServer() {
    return this._grpcServer;
  }

  get initialized() {
    return this._grpcServer.initialized;
  }

  static getInstance(grpcPort?: number): Core {
    if (!Core._instance) {
      if (isNil(grpcPort)) {
        throw new Error('Cannot initialize Core without grpcPort');
      }
      Core._instance = new Core(grpcPort);
    }
    return Core._instance;
  }

  async setConfig(moduleConfig: any): Promise<any> {
    const previousConfig = await this.configManager.get('core');
    let config = { ...previousConfig, ...moduleConfig };
    try {
      this.config.load(config).validate({
        allowed: 'strict',
      });
      config = this.config.getProperties();
    } catch (e) {
      (this.config as unknown) = convict(AppConfigSchema);
      this.config.load(previousConfig);
      throw new ConduitError('INVALID_ARGUMENT', 400, (e as Error).message);
    }
    this.grpcServer.sdk.bus!.publish('core:config:update', JSON.stringify(config));
    return config;
  }

  setConfigManager(configManager: any) {
    this.configManager = configManager;
  }
}
