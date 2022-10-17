import ConduitGrpcSdk, { ManagedModule, ConfigController, Indexable } from '..';

const convictConfigParser = (config: Indexable) => {
  if (typeof config === 'object') {
    Object.keys(config).forEach(key => {
      if (key === '_cvtProperties') {
        config = convictConfigParser(config._cvtProperties);
      } else {
        config[key] = convictConfigParser(config[key]);
      }
    });
  }
  return config;
};

export class ModuleManager<T> {
  private readonly serviceAddress: string;
  private readonly servicePort: string;
  private readonly grpcSdk: ConduitGrpcSdk;

  constructor(private readonly module: ManagedModule<T>) {
    if (!process.env.CONDUIT_SERVER) {
      throw new Error('CONDUIT_SERVER is undefined, specify Conduit server URL');
    }
    this.servicePort = process.env.GRPC_PORT ?? '5000';
    this.serviceAddress =
      // @compat (v0.15): SERVICE_IP -> SERVICE_URL
      process.env.SERVICE_URL || process.env.SERVICE_IP || '0.0.0.0:' + this.servicePort;
    try {
      this.grpcSdk = new ConduitGrpcSdk(
        process.env.CONDUIT_SERVER,
        () => {
          return this.module.healthState;
        },
        module.name,
      );
    } catch {
      throw new Error('Failed to initialize grpcSdk');
    }
  }

  async start() {
    await this.grpcSdk.initialize();
    this.module.initialize(this.grpcSdk, this.serviceAddress, this.servicePort);
    try {
      await this.preRegisterLifecycle();
      await this.grpcSdk.config.registerModule(
        this.module.name,
        this.module.address,
        this.module.healthState,
      );
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

  private async preRegisterLifecycle(): Promise<void> {
    await this.module.createGrpcServer();
    await this.module.preServerStart();
    await this.grpcSdk.initializeEventBus();
    await this.module.handleConfigSyncUpdate();
    await this.module.registerMetrics();
    await this.module.startGrpcServer();
    await this.module.onServerStart();
    await this.module.initializeMetrics();
    await this.module.preRegister();
  }

  private async postRegisterLifecycle(): Promise<void> {
    await this.module.onRegister();
    if (this.module.config) {
      const configSchema = this.module.config.getSchema();

      let config: any = this.module.config.getProperties();
      config = await this.module.preConfig(config);

      config = await this.grpcSdk.config.configure(
        config,
        convictConfigParser(configSchema),
        this.module.configOverride,
      );

      ConfigController.getInstance();
      if (config) ConfigController.getInstance().config = config;
      if (!config || config.active || !config.hasOwnProperty('active'))
        await this.module.onConfig();
    }
  }
}
