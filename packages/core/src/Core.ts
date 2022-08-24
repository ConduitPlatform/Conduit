import { ConduitError } from '@conduitplatform/grpc-sdk';
import { ConduitCommons, IConduitCore } from '@conduitplatform/commons';
import { GrpcServer } from './GrpcServer';
import { isNil } from 'lodash';
import AppConfigSchema, { Config as ConfigSchema } from './config';
import convict from 'convict';

export class Core extends IConduitCore {
  private static _instance: Core;
  private readonly _grpcServer: GrpcServer;
  readonly config: convict.Config<ConfigSchema> = convict(AppConfigSchema);

  get grpcServer() {
    return this._grpcServer;
  }

  get initialized() {
    return this._grpcServer.initialized;
  }

  private constructor(grpcPort: number) {
    super(ConduitCommons.getInstance('core'));
    this.commons.registerCore(this);
    this._grpcServer = new GrpcServer(this.commons, grpcPort);
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
    const previousConfig = await this.commons.getConfigManager().get('core');
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
}
