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

  /**
   * This is the first function triggered on module spin up.
   * @param grpcSdk
   */
  initialize(grpcSdk: ConduitGrpcSdk) {
    this.grpcSdk = grpcSdk;
  }

  /**
   * This is triggered before spinning up the Grpc Server
   * of the module. On this stage, the redis bus and state have
   * not yet been initialized, and only communications with Conduit core
   * have been established.
   */
  async preServerStart() {}

  /**
   * This is triggered right after Grpc Server start.
   * At this stage the core module will communicate with your service
   * for health checks, and the Bus and State management mechanics
   * are online and available.
   */
  async onServerStart() {}

  /**
   * Triggers right before registering the module with Conduit Core.
   */
  async preRegister() {}

  /**
   * Triggers when module has been registered with Conduit Core
   * This is the step where you should initialize your
   * module's general routing (admin or client) and any other operation,
   * that would require other modules being able to reach you
   */
  async onRegister() {}

  /**
   * This is triggered when the module receives new configuration.
   * At this step the configuration has not been checked yet,
   * and has only been parsed.
   * @param config
   */
  async preConfig(config: T) {
    return config;
  }

  /**
   * This is triggered when new configuration has been applied.
   * This happens either when changes are being made on the configuration,
   * or on module start up, where the config is recovered from the database.
   * In either case the configuration is now available through the
   * Config Controller of the sdk.
   */
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
      config = { ...this.config.getProperties(), ...config };
      config = await this.preConfig(config);
      const previousConfig = this.config.getProperties();
      try {
        this.config.load(config).validate();
        config = this.config.getProperties();
      } catch (e) {
        this.config.load(previousConfig);
        return callback({
          code: status.INVALID_ARGUMENT,
          message: 'Invalid configuration values: ' + (e as Error).message,
        });
      }
      ConfigController.getInstance().config = config;
      await this.onConfig();
      this.grpcSdk.bus?.publish(
        kebabCase(this.name) + ':config:update',
        JSON.stringify(config),
      );
      return callback(null, { updatedConfig: JSON.stringify(config) });
    } catch (e) {
      return callback({ code: status.INTERNAL, message: (e as Error).message });
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
