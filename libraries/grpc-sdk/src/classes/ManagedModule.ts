import ConduitGrpcSdk, {
  GrpcServer,
  ConduitService,
  SetConfigRequest,
  SetConfigResponse,
} from '..';
import { ConduitServiceModule } from './ConduitServiceModule';
import { ConfigController } from './ConfigController';
import { kebabCase } from 'lodash';
import { status } from '@grpc/grpc-js';
import convict from 'convict';

export abstract class ManagedModule<T> extends ConduitServiceModule {
  abstract readonly config?: convict.Config<T>;
  service?: ConduitService;

  protected constructor(moduleName: string) {
    super(moduleName);
  }

  get name() {
    return this._moduleName;
  }

  initialize(grpcSdk: ConduitGrpcSdk) {
    this.grpcSdk = grpcSdk;
  }

  async preServerStart() {}

  async onServerStart() {}

  async preRegister() {}

  async onRegister() {}

  async preConfig(config: T) {
    return config;
  }

  async onConfig() {}

  async createGrpcServer(servicePort?: string) {
    this.grpcServer = new GrpcServer(servicePort);
    this._port = (await this.grpcServer.createNewServer()).toString();
  }

  async startGrpcServer() {
    if (this.service) {
      this._serviceName = this.service.protoDescription.substring(
        this.service.protoDescription.indexOf('.') + 1,
      );
      await this.grpcServer.addService(
        this.service.protoPath,
        this.service.protoDescription,
        this.service.functions,
      );
      await this.addHealthCheckService();
      await this.grpcServer.start();
      ConduitGrpcSdk.Logger.log('gRPC server is online');
    }
  }

  async setConfig(call: SetConfigRequest, callback: SetConfigResponse) {
    try {
      if (!this.config) {
        return callback({
          code: status.INVALID_ARGUMENT,
          message: 'Module is not configurable',
        });
      }
      let config = JSON.parse(call.request.newConfig);
      config = await this.preConfig(config);
      try {
        this.config.load(config).validate();
      } catch (e) {
        return callback({
          code: status.INVALID_ARGUMENT,
          message: 'Invalid configuration values',
        });
      }
      const moduleConfig = await this.grpcSdk.config.updateConfig(config, this.name);
      ConfigController.getInstance().config = moduleConfig;
      await this.onConfig();
      this.grpcSdk.bus?.publish(
        kebabCase(this.name) + ':config:update',
        JSON.stringify(moduleConfig),
      );
      return callback(null, { updatedConfig: JSON.stringify(moduleConfig) });
    } catch (e) {
      return callback({ code: status.INTERNAL, message: e.message });
    }
  }

  protected async updateConfig(config?: T) {
    if (!this.config) {
      throw new Error('Module is not configurable');
    }
    if (config) {
      ConfigController.getInstance().config = config;
      return Promise.resolve();
    } else {
      return this.grpcSdk.config.get(this.name).then((config: T) => {
        ConfigController.getInstance().config = config;
      });
    }
  }
}
