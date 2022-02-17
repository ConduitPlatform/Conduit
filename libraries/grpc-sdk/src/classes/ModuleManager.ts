import ConduitGrpcSdk, {
  ManagedModule,
  ConfigController,
  SetConfigRequest,
  SetConfigResponse,
} from '..';
import { kebabCase } from 'lodash';
import { status } from '@grpc/grpc-js';

export class ModuleManager {
  private readonly serviceAddress: string;
  private readonly servicePort: string | undefined;
  private readonly grpcSdk: ConduitGrpcSdk;

  constructor(private readonly module: ManagedModule) {
    if (!process.env.CONDUIT_SERVER) {
      throw new Error('CONDUIT_SERVER is undefined, specify Conduit server URL');
    }
    this.serviceAddress = process.env.SERVICE_IP ? process.env.SERVICE_IP.split(':')[0] : '0.0.0.0';
    this.servicePort = process.env.SERVICE_IP ? process.env.SERVICE_IP.split(':')[1] : undefined;
    try {
      this.grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, module.name);
    } catch {
      throw new Error('Failed to initialize grpcSdk');
    }
  }

  start() {
    this.module.initialize(this.grpcSdk, this);
    this.preRegisterLifecycle()
      .then(() => {
        const url = (process.env.REGISTER_NAME === 'true'
          ? `${this.module.name}:`
          : `${this.serviceAddress}:`) + this.module.port;
        return this.grpcSdk.config.registerModule(this.module.name, url);
      })
      .catch((err: Error) => {
        console.log('Failed to initialize server');
        console.error(err);
        process.exit(-1);
      })
      .then(() => {
        return this.postRegisterLifecycle();
      })
      .catch((err: Error) => {
        console.log('Failed to activate module');
        console.error(err);
      });
  }

  private async preRegisterLifecycle(): Promise<void> {
    await this.module.startGrpcServer(this.servicePort);
    await this.module.onServerStart()
    await this.module.preRegister();
  }

  private async postRegisterLifecycle(): Promise<void> {
    await this.grpcSdk.initializeEventBus();
    await this.module.onRegister();
    if (this.module.config) {
      let config;
      try {
        await this.grpcSdk.config.get(this.module.name);
        config = await this.grpcSdk.config.addFieldstoConfig(
          this.module.config.getProperties(),
          this.module.name,
        );
      } catch (e) {
        await this.grpcSdk.config.updateConfig(
          this.module.config.getProperties(),
          this.module.name,
        );
      }
      ConfigController.getInstance(this.module);
      if (config) ConfigController.getInstance().config = config;
      if (!config || config.active) await this.module.onConfig();
    }
  }

  async setConfig(call: SetConfigRequest, callback: SetConfigResponse) {
    try {
      if (!this.module.config) {
        return callback({
          code: status.INVALID_ARGUMENT,
          message: 'Module is not configurable',
        });
      }
      const newConfig = JSON.parse(call.request.newConfig);
      await this.module.preConfig(newConfig);
      try {
        this.module.config.load(newConfig).validate();
      } catch (e) {
        return callback({
          code: status.INVALID_ARGUMENT,
          message: 'Invalid configuration values',
        });
      }
      const moduleConfig = await this.grpcSdk.config.updateConfig(newConfig, this.module.name);
      ConfigController.getInstance().config = moduleConfig;
      await this.module.onConfig();
      this.grpcSdk.bus?.publish(kebabCase(this.module.name) + ':config:update', JSON.stringify(moduleConfig));
      return callback(null, { updatedConfig: JSON.stringify(moduleConfig) });
    } catch (e) {
      return callback({ code: status.INTERNAL, message: e.message });
    }
  }
}
