import { ConduitServiceModule, ConfigController, GrpcServer } from './classes';
import { kebabCase } from 'lodash';
import { status } from '@grpc/grpc-js';
import convict from 'convict';
import { ConduitService } from './interfaces';
import ConduitGrpcSdk, {
  IConduitLogger,
  SetConfigRequest,
  SetConfigResponse,
} from '@conduitplatform/grpc-sdk';
import { merge } from './utilities';
import { ConduitLogger, setupLoki } from './logging';
import winston from 'winston';
import path from 'path';
import { ConduitMetrics } from './metrics';
import { clientMiddleware } from './metrics/clientMiddleware';
import { convictConfigParser } from './utilities/convictConfigParser';

export abstract class ManagedModule<T> extends ConduitServiceModule {
  readonly config?: convict.Config<T>;
  configOverride: boolean = false;
  service?: ConduitService;
  protected abstract readonly configSchema?: object;
  protected abstract readonly metricsSchema?: object;
  private readonly serviceAddress: string;
  private readonly servicePort: string;

  protected constructor(moduleName: string) {
    super(moduleName);
    if (!process.env.CONDUIT_SERVER) {
      throw new Error('CONDUIT_SERVER is undefined, specify Conduit server URL');
    }
    this.servicePort = process.env.GRPC_PORT ?? '5000';
    this.serviceAddress =
      // @compat (v0.15): SERVICE_IP -> SERVICE_URL
      process.env.SERVICE_URL || process.env.SERVICE_IP || '0.0.0.0:' + this.servicePort;
    try {
      let logger: IConduitLogger;
      try {
        logger = new ConduitLogger([
          new winston.transports.File({
            filename: path.join(__dirname, '.logs/combined.log'),
            level: 'info',
          }),
          new winston.transports.File({
            filename: path.join(__dirname, '.logs/errors.log'),
            level: 'error',
          }),
        ]);
      } catch (e) {
        logger = new ConduitLogger();
      }
      this.grpcSdk = new ConduitGrpcSdk(
        process.env.CONDUIT_SERVER,
        moduleName,
        true,
        logger,
        () => {
          return this.healthState;
        },
      );
      setupLoki(this.grpcSdk.name, this.grpcSdk.instance).then();
      if (process.env.METRICS_PORT) {
        ConduitGrpcSdk.Metrics = new ConduitMetrics(
          this.grpcSdk.name,
          this.grpcSdk.instance,
        );
        this.grpcSdk.addMiddleware(clientMiddleware());
      }
    } catch {
      throw new Error('Failed to initialize grpcSdk');
    }
  }

  get name() {
    return this._moduleName;
  }

  get address() {
    return this._address;
  }

  async start() {
    await this.grpcSdk.initialize();
    this.initialize(this.grpcSdk, this.serviceAddress, this.servicePort);
    try {
      await this.preRegisterLifecycle();
      await this.grpcSdk.config.registerModule(this.name, this.address, this.healthState);
    } catch (err) {
      ConduitGrpcSdk.Logger.error('Failed to initialize server');
      ConduitGrpcSdk.Logger.error(err as Error);
      process.exit(-1);
    }
    await this.postRegisterLifecycle().catch((err: Error) => {
      ConduitGrpcSdk.Logger.error('Failed to activate module');
      ConduitGrpcSdk.Logger.error(err);
      process.exit(-1);
    });
  }

  /**
   * This is the first function triggered on module spin up.
   * @param grpcSdk {ConduitGrpcSdk}
   * @param address {string} external address:port of service (LoadBalancer)
   * @param port {string} port to bring up gRPC service
   */
  initialize(grpcSdk: ConduitGrpcSdk, address: string, port: string) {
    this.grpcSdk = grpcSdk;
    this._address = address;
    this._port = port;
    if (this.configSchema) {
      (this.config as unknown) = convict(this.configSchema);
    }
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

  /**
   * Registers common and module-specific metric types.
   */
  async registerMetrics() {
    if (ConduitGrpcSdk.Metrics) {
      ConduitGrpcSdk.Metrics.initializeDefaultMetrics();
      if (this.metricsSchema) {
        Object.values(this.metricsSchema).forEach(metric => {
          ConduitGrpcSdk.Metrics!.registerMetric(metric.type, metric.config);
        });
      }
    }
  }

  /**
   * Initializes metric startup values.
   * Implemented by individual modules.
   */
  async initializeMetrics() {}

  async createGrpcServer() {
    this.grpcServer = new GrpcServer(this._port);
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
      ConduitGrpcSdk.Logger.log('gRPC server listening on ' + this._port);
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
      config = merge(this.config.getProperties(), config);
      config = await this.preConfig(config);
      const previousConfig = this.config.getProperties();
      try {
        this.config.load(config).validate({
          allowed: 'strict',
        });
        config = this.config.getProperties();
        callback(null, { updatedConfig: JSON.stringify(config) });
      } catch (e) {
        (this.config as unknown) = convict(this.configSchema!);
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
    } catch (e) {
      return callback({ code: status.INTERNAL, message: (e as Error).message });
    }
  }

  /** Used to update the module's configuration on initial Redis/DB reconciliation. */
  async handleConfigSyncUpdate() {
    if (!this.config) return;
    this.grpcSdk.bus!.subscribe(`${this.name}:config:update`, async (message: string) => {
      ConfigController.getInstance().config = await this.preConfig(JSON.parse(message));
      await this.onConfig();
    });
  }

  private async preRegisterLifecycle(): Promise<void> {
    await this.createGrpcServer();
    await this.preServerStart();
    await this.grpcSdk.initializeEventBus();
    await this.handleConfigSyncUpdate();
    await this.registerMetrics();
    await this.startGrpcServer();
    await this.onServerStart();
    await this.initializeMetrics();
    await this.preRegister();
  }

  private async postRegisterLifecycle(): Promise<void> {
    await this.onRegister();
    if (this.config) {
      const configSchema = this.config.getSchema();

      let config: any = this.config.getProperties();
      config = await this.preConfig(config);

      config = await this.grpcSdk.config.configure(
        config,
        convictConfigParser(configSchema),
        this.configOverride,
      );

      ConfigController.getInstance();
      if (config) ConfigController.getInstance().config = config;
      if (!config || config.active || !config.hasOwnProperty('active'))
        await this.onConfig();
    }
  }
}
