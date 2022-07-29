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
  private readonly servicePort: string | undefined;
  private readonly grpcSdk: ConduitGrpcSdk;

  constructor(private readonly module: ManagedModule<T>) {
    if (!process.env.CONDUIT_SERVER) {
      throw new Error('CONDUIT_SERVER is undefined, specify Conduit server URL');
    }
    this.serviceAddress = process.env.SERVICE_IP
      ? process.env.SERVICE_IP.split(':')[0]
      : '0.0.0.0';
    this.servicePort = process.env.SERVICE_IP
      ? process.env.SERVICE_IP.split(':')[1]
      : undefined;
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
    this.module.initialize(this.grpcSdk);
    const self = this;
    try {
      await this.preRegisterLifecycle();
      const url =
        (process.env.REGISTER_NAME === 'true'
          ? `${self.module.name}:`
          : `${self.serviceAddress}:`) + self.module.port;
      await self.grpcSdk.config.registerModule(
        self.module.name,
        url,
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
    await this.module.createGrpcServer(this.servicePort);
    await this.module.preServerStart();
    await this.grpcSdk.initializeEventBus();
    await this.module.handleConfigSyncUpdate();
    await this.module.startGrpcServer();
    await this.module.onServerStart();
    await this.module.preRegister();
    await this.initializeMetrics();
  }

  private async postRegisterLifecycle(): Promise<void> {
    await this.module.onRegister();
    if (this.module.config) {
      const configSchema = this.module.config.getSchema();
      const config = await this.grpcSdk.config.configure(
        this.module.config.getProperties(),
        convictConfigParser(configSchema),
      );

      ConfigController.getInstance();
      if (config) ConfigController.getInstance().config = config;
      if (!config || config.active || !config.hasOwnProperty('active'))
        await this.module.onConfig();
    }
  }

  private initializeMetrics() {
    if (process.env['METRICS_PORT']) {
      this.grpcSdk.initializeDefaultMetrics();
      this.module.initializeMetrics();
    }
  }
}
