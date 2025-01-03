import { EventEmitter } from 'events';
import { ConduitModule } from '../../classes/index.js';
import { HealthCheckStatus } from '../../types/index.js';
import {
  ConfigDefinition,
  ModuleHealthRequest,
  RegisterModuleRequest,
} from '../../protoUtils/index.js';
import { Indexable } from '../../interfaces/index.js';
import { ConduitGrpcSdk } from '../../index.js';
import { ClusterOptions, RedisOptions } from 'ioredis';

export class Config extends ConduitModule<typeof ConfigDefinition> {
  private readonly emitter = new EventEmitter();
  private coreLive = false;
  private readonly _serviceHealthStatusGetter?: () => HealthCheckStatus;

  constructor(
    moduleName: string,
    readonly url: string,
    serviceHealthStatusGetter?: () => HealthCheckStatus,
    grpcToken?: string,
  ) {
    super(moduleName, 'config', url, grpcToken);
    this.initializeClient(ConfigDefinition);
    this._serviceHealthStatusGetter = serviceHealthStatusGetter;
    this.emitter.setMaxListeners(150);
  }

  getServerConfig() {
    const request = {};
    return this.client!.getServerConfig(request).then(res => {
      return JSON.parse(res.data);
    });
  }

  getModuleUrlByName(name: string): Promise<{ url: string }> {
    if (name === 'core') return Promise.resolve({ url: this.url });
    return this.client!.getModuleUrlByName({ name: name }).then(res => {
      return { url: res.moduleUrl };
    });
  }

  get(name: string) {
    const request = {
      key: name,
    };
    return this.client!.get(request).then(res => {
      return JSON.parse(res.data);
    });
  }

  configure(config: any, schema: any, override: boolean) {
    const request = {
      config: JSON.stringify(config),
      schema: JSON.stringify(schema),
      override,
    };
    return this.client!.configure(request).then(res => {
      return JSON.parse(res.result);
    });
  }

  moduleExists(name: string) {
    const request = {
      moduleName: name,
    };
    return this.client!.moduleExists(request);
  }

  moduleList(): Promise<any[]> {
    const request = {};
    return this.client!.moduleList(request)
      .then(res => res.modules)
      .catch(err => {
        if (this._clientName === 'core') return [];
        throw err;
      });
  }

  async getRedisDetails(): Promise<{
    standalone?: RedisOptions;
    cluster?: ClusterOptions;
    redisHost?: string;
    redisPort?: number;
    redisUsername?: string;
    redisPassword?: string;
    redisConfig?: string;
  }> {
    const request: Indexable = {};
    const r = await this.client!.getRedisDetails(request);
    return {
      ...(r.standalone ? { standalone: JSON.parse(r.standalone) } : undefined),
      ...(r.cluster ? { cluster: JSON.parse(r.cluster) } : undefined),
      // maintain backwards compatibility with <=grpc-sdk-v0.16.0-alpha.20
      redisHost: r.redisHost,
      redisPort: r.redisPort,
      redisUsername: r.redisUsername,
      redisPassword: r.redisPassword,
      redisConfig: r.redisConfig,
    };
  }

  registerModule(
    name: string,
    url: string,
    healthStatus: Omit<HealthCheckStatus, HealthCheckStatus.SERVICE_UNKNOWN>,
    instanceId: string,
  ) {
    const request: RegisterModuleRequest = {
      moduleName: name.toString(),
      url: url.toString(),
      healthStatus: healthStatus as number,
      instanceId,
    };
    const self = this;
    return this.client!.registerModule(request).then(res => {
      self.coreLive = true;
      return res.result;
    });
  }

  moduleHealthProbe(name: string, url: string, instanceId: string) {
    const request: ModuleHealthRequest = {
      moduleName: name.toString(),
      status: this._serviceHealthStatusGetter
        ? this._serviceHealthStatusGetter()
        : HealthCheckStatus.SERVICE_UNKNOWN,
      instanceId,
    };
    const self = this;
    this.client!.moduleHealthProbe(request)
      .then(res => {
        if (!res && self.coreLive) {
          ConduitGrpcSdk.Logger.warn('Core unhealthy');
          self.coreLive = false;
        } else if (res && !self.coreLive) {
          ConduitGrpcSdk.Logger.log('Core is live');
          self.coreLive = true;
          self.watchModules();
        }
      })
      .catch(() => {
        if (self.coreLive) {
          ConduitGrpcSdk.Logger.warn('Core unhealthy');
          self.coreLive = false;
        }
      });
  }

  getModuleWatcher() {
    return this.emitter;
  }

  async watchModules() {
    if (!this.coreLive) {
      this.coreLive = true;
    }
    this.emitter.emit('serving-modules-update', await this.moduleList().catch());
    try {
      const call = this.client!.watchModules({});
      for await (const data of call) {
        this.emitter.emit('serving-modules-update', data.modules);
      }
    } catch (error) {
      this.coreLive = false;
      ConduitGrpcSdk.Logger.warn('Core unhealthy');
      this.emitter.emit('core-status-update', HealthCheckStatus.UNKNOWN);
    }
  }
}
