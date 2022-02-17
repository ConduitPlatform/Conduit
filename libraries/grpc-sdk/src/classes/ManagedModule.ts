import ConduitGrpcSdk, {
  DatabaseProvider,
  GrpcServer,
  ConduitService,
  ModuleManager,
  SetConfigRequest,
  SetConfigResponse
} from '..';
import { ConduitServiceModule } from './ConduitServiceModule';
import { ConfigController } from './ConfigController';
import { camelCase } from 'lodash';
import convict from 'convict';

export abstract class ManagedModule extends ConduitServiceModule {
  readonly name: string;
  private manager: ModuleManager | undefined;
  abstract readonly config?: convict.Config<any>;
  service?: ConduitService;

  protected constructor(moduleName: string) {
    moduleName = camelCase(moduleName);
    super();
    this.name = moduleName;
    this._database = undefined;
  }

  initialize(grpcSdk: ConduitGrpcSdk, manager: ModuleManager) {
    this.grpcSdk = grpcSdk;
    this.manager = manager;
  }

  private _database: DatabaseProvider | undefined;

  protected get database(): DatabaseProvider {
    if (!this._database) throw new Error('Database not currently requested. Call useDatabase() first.');
    return this._database;
  }

  async onServerStart() {}

  async preRegister() {}

  async onRegister() {}

  async preConfig(config: any) {}

  async onConfig() {}

  async startGrpcServer(servicePort?: string) {
    this.grpcServer = new GrpcServer(servicePort);
    this._port = (await this.grpcServer.createNewServer()).toString();
    if (this.service) {
      await this.grpcServer.addService(this.service.protoPath, this.service.protoDescription, this.service.functions);
      await this.grpcServer.start();
      console.log('Grpc server is online');
    }
  }

  async setConfig(call: SetConfigRequest, callback: SetConfigResponse) {
    this.manager!.setConfig(call, callback);
  }

  protected async useDatabase() {
    await this.grpcSdk.waitForExistence('database');
    this._database = this.grpcSdk.databaseProvider!;
  }

  protected async updateConfig(config?: any) {
    if (!this.config) {
      throw new Error('Module is not configurable');
    }
    if (config) {
      ConfigController.getInstance().config = config;
      // await ConfigController.getInstance().addConfigService(this.grpcServer, this.name);
      return Promise.resolve();
    } else {
      return this.grpcSdk.config.get(this.name).then((config: any) => {
        ConfigController.getInstance().config = config;
      });
    }
  }
}
