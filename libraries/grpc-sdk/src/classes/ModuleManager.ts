import ConduitGrpcSdk, {
  ManagedModule,
  ConfigController,
} from '..';

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
    this.grpcSdk.initialize().then(() => {
      this.module.initialize(this.grpcSdk);
      const self = this;
      this.preRegisterLifecycle()
        .then(() => {
          const url = (process.env.REGISTER_NAME === 'true'
            ? `${self.module.name}:`
            : `${self.serviceAddress}:`) + self.module.port;
          return self.grpcSdk.config.registerModule(self.module.name, url);
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
    });
  }

  private async preRegisterLifecycle(): Promise<void> {
    await this.module.createGrpcServer(this.servicePort);
    await this.module.preServerStart();
    await this.module.startGrpcServer();
    await this.module.onServerStart();
    await this.grpcSdk.initializeEventBus();
    await this.module.preRegister();
  }

  private async postRegisterLifecycle(): Promise<void> {
    await this.module.onRegister();
    if (this.module.config) {
      let config;
      try {
        await this.grpcSdk.config.get(this.module.name);
      } catch (e) {
        await this.grpcSdk.config.updateConfig(
          this.module.config.getProperties(),
          this.module.name,
        );
      }
      config = await this.grpcSdk.config.addFieldsToConfig(
        this.module.config.getProperties(),
        this.module.name,
      );
      ConfigController.getInstance();
      if (config) ConfigController.getInstance().config = config;
      if (!config || config.active) await this.module.onConfig();
    }
  }
}
