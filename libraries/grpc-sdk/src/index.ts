import {
  Admin,
  Chat,
  Config,
  Core,
  DatabaseProvider,
  Email,
  Forms,
  PushNotifications,
  Router,
  SMS,
  Storage,
} from './modules';
import { Authentication } from './modules/authentication';
import Crypto from 'crypto';
import { EventBus } from './utilities/EventBus';
import { RedisManager } from './utilities/RedisManager';
import { StateManager } from './utilities/StateManager';
import { CompatServiceDefinition } from 'nice-grpc/lib/service-definitions';
import { ConduitModule } from './classes/ConduitModule';
import { Client } from 'nice-grpc';
import { status } from '@grpc/grpc-js';
import { sleep } from './utilities';
import { HealthDefinition } from './protoUtils/grpc_health_check';
import { HealthCheckStatus } from './types';
import { createSigner } from 'fast-jwt';

export default class ConduitGrpcSdk {
  private readonly serverUrl: string;
  private readonly _watchModules: boolean;
  private readonly _core?: Core;
  private readonly _config?: Config;
  private readonly _admin?: Admin;
  private readonly _router?: Router;
  private readonly _modules: { [key: string]: ConduitModule<any> } = {};
  private readonly _availableModules: any = {
    database: DatabaseProvider,
    storage: Storage,
    email: Email,
    pushNotifications: PushNotifications,
    authentication: Authentication,
    sms: SMS,
    chat: Chat,
    forms: Forms,
  };
  private _dynamicModules: { [key: string]: CompatServiceDefinition } = {};
  private _eventBus?: EventBus;
  private _stateManager?: StateManager;
  private lastSearch: number = Date.now();
  private readonly name: string;
  private readonly _serviceHealthStatusGetter: Function;
  private readonly _grpcToken?: string;
  private _initialized: boolean = false;

  constructor(serverUrl: string, serviceHealthStatusGetter: Function, name?: string, watchModules = true) {
    if (!name) {
      this.name = 'module_' + Crypto.randomBytes(16).toString('hex');
    } else {
      this.name = name;
    }
    this.serverUrl = serverUrl;
    this._watchModules = watchModules;
    this._serviceHealthStatusGetter = serviceHealthStatusGetter;
    const grpcKey = process.env.GRPC_KEY;
    if (grpcKey) {
      const sign = createSigner({ key: grpcKey });
      this._grpcToken = sign({
        moduleName: this.name,
      });
    }
  }

  async initialize() {
    if (this.name === 'core') {
      this._initialize();
    } else {
      (this._core as any) = new Core(this.name, this.serverUrl, this._grpcToken);
      console.log('Waiting for Core...');
      const delay = this.name === 'database' ? 250 : 1000;
      while (true) {
        try {
          const state = await this.core.check();
          if (this.name === 'database' || (state as unknown as HealthCheckStatus) === HealthCheckStatus.SERVING) {
            console.log('Core connection established');
            this._initialize();
            break;
          }
        } catch (err) {
          if (err.code === status.PERMISSION_DENIED) {
            console.error(err);
            process.exit(-1);
          }
          await sleep(delay);
        }
      }
    }
  }

  private _initialize() {
    if (this._initialized) throw new Error('Module\'s grpc-sdk has already been initialized');
    (this._config as any)  = new Config(this.name, this.serverUrl, this._serviceHealthStatusGetter, this._grpcToken);
    (this._admin as any) = new Admin(this.name, this.serverUrl, this._grpcToken);
    (this._router as any)  = new Router(this.name, this.serverUrl, this._grpcToken);
    this.initializeModules().then();
    if (this._watchModules) {
      this.watchModules();
    }
    this._initialized = true;
  }

  get bus(): EventBus | null {
    if (this._eventBus) {
      return this._eventBus;
    } else {
      console.warn('Event bus not initialized');
      return null;
    }
  }

  get state(): StateManager | null {
    if (this._stateManager) {
      return this._stateManager;
    } else {
      console.warn('State Manager not initialized');
      return null;
    }
  }

  get core(): Core {
    return this._core!;
  }

  get config(): Config {
    return this._config!;
  }

  get admin(): Admin {
    return this._admin!;
  }

  get router(): Router {
    return this._router!;
  }

  get database(): DatabaseProvider | null {
    if (this._modules['database']) {
      return this._modules['database'] as DatabaseProvider;
    } else {
      console.warn('Database provider not up yet!');
      return null;
    }
  }

  get databaseProvider(): DatabaseProvider | null {
    return this.database;
  }

  get storage(): Storage | null {
    if (this._modules['storage']) {
      return this._modules['storage'] as Storage;
    } else {
      console.warn('Storage module not up yet!');
      return null;
    }
  }

  get forms(): Forms | null {
    if (this._modules['forms']) {
      return this._modules['forms'] as Forms;
    } else {
      console.warn('Forms module not up yet!');
      return null;
    }
  }

  get emailProvider(): Email | null {
    if (this._modules['email']) {
      return this._modules['email'] as Email;
    } else {
      console.warn('Email provider not up yet!');
      return null;
    }
  }

  get pushNotifications(): PushNotifications | null {
    if (this._modules['pushNotifications']) {
      return this._modules['pushNotifications'] as PushNotifications;
    } else {
      console.warn('Push notifications module not up yet!');
      return null;
    }
  }

  get authentication(): Authentication | null {
    if (this._modules['authentication']) {
      return this._modules['authentication'] as Authentication;
    } else {
      console.warn('Authentication module not up yet!');
      return null;
    }
  }

  get sms(): SMS | null {
    if (this._modules['sms']) {
      return this._modules['sms'] as SMS;
    } else {
      console.warn('SMS module not up yet!');
      return null;
    }
  }

  get chat(): Chat | null {
    if (this._modules['chat']) {
      return this._modules['chat'] as Chat;
    } else {
      console.warn('Chat module not up yet!');
      return null;
    }
  }

  watchModules() {
    const emitter = this.config.getModuleWatcher();
    this.config.watchModules().then();
    emitter.on('serving-modules-update', (modules: any) => {
      Object.keys(this._modules).forEach((r) => {
        let found = modules.filter((m: any) => m.moduleName === r);
        if ((!found || found.length === 0) && this._availableModules[r]) {
          this._modules[r]?.closeConnection();
        }
      });
      modules.forEach((m: any) => {
        if (this._modules[m.moduleName] && this._availableModules[m.moduleName]) {
          this._modules[m.moduleName]?.openConnection();
        }
        this.createModuleClient(m.moduleName, m.url);
      });
    });
  }

  initializeEventBus(): Promise<any> {
    return this.config
      .getRedisDetails()
      .then((r: any) => {
        let redisManager = new RedisManager(r.redisHost, r.redisPort);
        this._eventBus = new EventBus(redisManager);
        this._stateManager = new StateManager(redisManager, this.name);
        return this._eventBus;
      })
      .catch((err: any) => {
        console.error('Failed to initialize event bus');
        throw err;
      });
  }

  /**
   * Gets all the registered modules from the config and creates clients for them.
   * This will only work on known modules, since the primary usage for the sdk is internal
   */
  initializeModules() {
    return this._config!
      .moduleList()
      .then((r) => {
        this.lastSearch = Date.now();
        r.forEach((m) => {
          this.createModuleClient(m.moduleName, m.url);
        });
        return 'ok';
      })
      .catch((err) => {
        if (err.code !== 5) {
          console.error(err);
        }
      });
  }

  createModuleClient(moduleName: string, moduleUrl: string) {
    if (this._modules[moduleName] || (!this._availableModules[moduleName] && !this._dynamicModules[moduleName])) return;
    if (this._availableModules[moduleName]) {
      this._modules[moduleName] = new this._availableModules[moduleName](
        this.name,
        moduleUrl,
        this._grpcToken,
      );
    } else if (this._dynamicModules[moduleName]) {
      this._modules[moduleName] = new ConduitModule(this.name, moduleName, moduleUrl, this._grpcToken);
      this._modules[moduleName].initializeClient(this._dynamicModules[moduleName]);
    }
  }

  moduleClient(name: string, type: CompatServiceDefinition): void {
    this._dynamicModules[name] = type;
  }

  getModule<T extends CompatServiceDefinition>(name: string): Client<T> | undefined {
    if (this._modules[name]) return this._modules[name].client!;
  }

  getHealthClient<T extends CompatServiceDefinition>(name: string): Client<typeof HealthDefinition> | undefined {
    if (this._modules[name]) return this._modules[name].healthClient!;
  }

  isAvailable(moduleName: string) {
    return !!(this._modules[moduleName] && this._modules[moduleName].active);
  }

  async waitForExistence(moduleName: string) {
    while (!this._modules[moduleName]) {
      await sleep(1000);
    }
    return true;
  }

  /**
   * Used to refresh all modules to check for new registrations
   * @param force If true will check for new modules no matter the interval
   */
  async refreshModules(force?: boolean) {
    if (this.lastSearch < Date.now() - 3000 || force) {
      return this.initializeModules();
    }
    return 'ok';
  }

  get grpcToken() {
    return this._grpcToken;
  }
}

export * from './interfaces';
export * from './classes';
export * from './modules';
export * from './helpers';
export * from './constants';
export * from './types';
