import {
  ConfigController,
  HealthCheckStatus,
  ManagedModule,
} from '@conduitplatform/grpc-sdk';
import { Config } from './config';
import AppConfigSchema from '@conduitplatform/chat/dist/config';
import path from 'path';

export default class TestModule extends ManagedModule<Config> {
  configSchema = AppConfigSchema;
  service = {
    protoPath: path.resolve(__dirname, 'test.proto'),
    protoDescription: 'test.Test',
    functions: {
      setConfig: this.setConfig.bind(this),
    },
  };
  constructor() {
    super('test');
    this.updateHealth(HealthCheckStatus.UNKNOWN, true);
  }

  async onServerStart() {
    await this.grpcSdk.monitorModule('authentication', serving => {
      this.updateHealth(
        serving ? HealthCheckStatus.SERVING : HealthCheckStatus.NOT_SERVING,
      );
    });
  }

  async onConfig() {
    const config = await ConfigController.getInstance().config;
    if (!config.active) {
      this.updateHealth(HealthCheckStatus.NOT_SERVING);
    } else {
      this.updateHealth(HealthCheckStatus.SERVING);
    }
  }
}
