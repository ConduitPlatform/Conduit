import {
  Admin,
  Authentication,
  Authorization,
  Chat,
  Communications,
  Config,
  Core,
  DatabaseProvider,
  Email,
  PushNotifications,
  Router,
  SMS,
  Storage,
} from './modules/index.js';
import crypto from 'crypto';
import {
  EventBus,
  getJsonEnv,
  RedisManager,
  sleep,
  StateManager,
} from './utilities/index.js';
import {
  addMiddleware,
  getInterceptors,
  getLogger,
  getMetrics,
  setLogger,
  setMetrics,
} from './utilities/GrpcSdkContext.js';
import { checkModuleHealth, ConduitModule } from './classes/index.js';
import { Client, CompatServiceDefinition } from 'nice-grpc';
import { status } from '@grpc/grpc-js';
import {
  AwaitPeerOptions,
  GrpcError,
  HealthCheckStatus,
  PeerWatchBatchOptions,
  PeerWatchOptions,
  PeerWatchSpec,
} from './types/index.js';
import { createSigner } from 'fast-jwt';
import { ClusterOptions, RedisOptions } from 'ioredis';
import { IConduitLogger, IConduitMetrics } from './interfaces/index.js';
import {
  ConduitModuleDefinition,
  HealthCheckResponse_ServingStatus,
  HealthDefinition,
  ModuleListResponse_ModuleResponse,
} from './protoUtils/index.js';

type UrlRemap = { [url: string]: string };

const COMMUNICATIONS_LEGACY_MODULES = ['email', 'sms', 'pushNotifications'] as const;

class ConduitGrpcSdk {
  public readonly name: string;
  public readonly instance: string;
  private readonly serverUrl: string;
  private readonly _watchModules: boolean;
  private readonly _core?: Core;
  private readonly _config?: Config;
  private readonly _admin?: Admin;
  private readonly _modules: { [key: string]: ConduitModule<any> } = {};
  private readonly _availableModules: any = {
    router: Router,
    database: DatabaseProvider,
    storage: Storage,
    email: Email,
    pushNotifications: PushNotifications,
    authentication: Authentication,
    authorization: Authorization,
    sms: SMS,
    chat: Chat,
    communications: Communications,
  };
  private _dynamicModules: { [key: string]: CompatServiceDefinition } = {};
  private _eventBus?: EventBus;
  private _stateManager?: StateManager;
  private lastSearch: number = Date.now();
  private readonly urlRemap?: UrlRemap;
  private readonly _serviceHealthStatusGetter: () => HealthCheckStatus;
  private readonly _grpcToken?: string;
  private _initialized: boolean = false;
  private readonly _moduleMonitorListeners = new Map<string, Set<(s: boolean) => void>>();
  private readonly _communicationsLegacyConnectionStates = new Map<string, boolean>();

  constructor(
    serverUrl: string,
    name?: string,
    watchModules = true,
    logger?: IConduitLogger,
    serviceHealthStatusGetter: () => HealthCheckStatus = () => HealthCheckStatus.SERVING,
  ) {
    if (logger) {
      setLogger(logger);
    } else {
      setLogger(console);
    }

    if (!name) {
      this.name = 'module_' + crypto.randomBytes(16).toString('hex');
    } else {
      this.name = name;
    }
    this.instance = this.name.startsWith('module_')
      ? this.name.substring(8)
      : crypto.randomBytes(16).toString('hex');

    this.urlRemap = getJsonEnv<UrlRemap>(
      'URL_REMAP',
      process.env.URL_REMAP,
      stringConf => ({
        '*': stringConf,
      }),
    );

    this.serverUrl = serverUrl;
    this._watchModules = watchModules;
    this._serviceHealthStatusGetter = serviceHealthStatusGetter;
    if (process.env.GRPC_KEY) {
      const sign = createSigner({ key: process.env.GRPC_KEY });
      this._grpcToken = sign({
        moduleName: this.name,
      });
    }
  }

  static get Logger() {
    return getLogger();
  }

  static get Sleep() {
    return sleep;
  }

  static get Metrics() {
    return getMetrics();
  }

  static set Metrics(metrics: IConduitMetrics | undefined) {
    setMetrics(metrics);
  }

  static get interceptors() {
    return getInterceptors();
  }

  private _redisManager: RedisManager | null = null;

  get redisManager(): RedisManager {
    if (this._redisManager) {
      return this._redisManager;
    } else {
      throw new Error('Redis not available');
    }
  }

  private _redisDetails?:
    | RedisOptions
    | { nodes: { host: string; port: number }[]; options: ClusterOptions };

  get redisDetails():
    | RedisOptions
    | { nodes: { host: string; port: number }[]; options: ClusterOptions } {
    if (this._redisDetails) {
      return this._redisDetails;
    } else {
      throw new Error('Redis not available');
    }
  }

  get bus(): EventBus | null {
    if (this._eventBus) {
      return this._eventBus;
    } else {
      ConduitGrpcSdk.Logger.warn('Event bus not initialized');
      return null;
    }
  }

  get state(): StateManager | null {
    if (this._stateManager) {
      return this._stateManager;
    } else {
      ConduitGrpcSdk.Logger.warn('State Manager not initialized');
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

  get router(): Router | null {
    if (this._modules['router']) {
      return this._modules['router'] as Router;
    } else {
      ConduitGrpcSdk.Logger.warn('Router not up yet!');
      return null;
    }
  }

  get database(): DatabaseProvider | null {
    if (this._modules['database']) {
      return this._modules['database'] as DatabaseProvider;
    } else {
      ConduitGrpcSdk.Logger.warn('Database provider not up yet!');
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
      ConduitGrpcSdk.Logger.warn('Storage module not up yet!');
      return null;
    }
  }

  get emailProvider(): Email | null {
    if (this._modules['email']) {
      return this._modules['email'] as Email;
    } else {
      ConduitGrpcSdk.Logger.warn('Email provider not up yet!');
      return null;
    }
  }

  get pushNotifications(): PushNotifications | null {
    if (this._modules['pushNotifications']) {
      return this._modules['pushNotifications'] as PushNotifications;
    } else {
      ConduitGrpcSdk.Logger.warn('Push notifications module not up yet!');
      return null;
    }
  }

  get authentication(): Authentication | null {
    if (this._modules['authentication']) {
      return this._modules['authentication'] as Authentication;
    } else {
      ConduitGrpcSdk.Logger.warn('Authentication module not up yet!');
      return null;
    }
  }

  get authorization(): Authorization | null {
    if (this._modules['authorization']) {
      return this._modules['authorization'] as Authorization;
    } else {
      ConduitGrpcSdk.Logger.warn('Authorization module not up yet!');
      return null;
    }
  }

  get sms(): SMS | null {
    if (this._modules['sms']) {
      return this._modules['sms'] as SMS;
    } else {
      ConduitGrpcSdk.Logger.warn('SMS module not up yet!');
      return null;
    }
  }

  get chat(): Chat | null {
    if (this._modules['chat']) {
      return this._modules['chat'] as Chat;
    } else {
      ConduitGrpcSdk.Logger.warn('Chat module not up yet!');
      return null;
    }
  }

  get grpcToken() {
    return this._grpcToken;
  }

  public addMiddleware(middleware: any) {
    addMiddleware(middleware);
  }

  async initialize() {
    if (this.name === 'core') {
      return this._initialize();
    }
    (this._core as unknown) = new Core(this.name, this.serverUrl, this._grpcToken);
    await this.connectToCore().catch(() => process.exit(-1));
    this._initialize();
  }

  async connectToCore() {
    ConduitGrpcSdk.Logger.log('Waiting for Core...');
    while (true) {
      try {
        this.core.openConnection();
        const state = await this.core.check();
        if ((state as unknown as HealthCheckStatus) === HealthCheckStatus.SERVING) {
          ConduitGrpcSdk.Logger.log('Core connection established');
          return;
        }
      } catch (err) {
        if ((err as GrpcError).code === status.PERMISSION_DENIED) {
          ConduitGrpcSdk.Logger.error(err as Error);
          throw err;
        }
        await sleep(1000);
      }
    }
  }

  watchModules() {
    const emitter = this.config.getModuleWatcher();
    this.config.watchModules().then();
    emitter.on('serving-modules-update', modules => {
      const legacySet = new Set<string>(COMMUNICATIONS_LEGACY_MODULES);
      Object.keys(this._modules).forEach(r => {
        if (r === this.name) return;
        if (legacySet.has(r)) return;
        const found = modules.filter(
          (m: ModuleListResponse_ModuleResponse) => m.moduleName === r && m.serving,
        );
        if ((!found || found.length === 0) && this._modules[r]) {
          this._modules[r]?.closeConnection();
          emitter.emit(`module-connection-update:${r}`, false);
          if (r === 'communications') {
            this.syncCommunicationsLegacyClients(false, emitter);
          }
        }
      });
      modules.forEach((m: ModuleListResponse_ModuleResponse) => {
        if (m.moduleName === this.name || !m.serving) return;
        const alreadyActive = this._modules[m.moduleName]?.active;
        if (alreadyActive && m.moduleName !== 'communications') return;
        if (!alreadyActive) {
          if (this._availableModules[m.moduleName] && this._modules[m.moduleName]) {
            this._modules[m.moduleName].openConnection();
          } else {
            this.createModuleClient(m.moduleName, m.url);
          }
          emitter.emit(`module-connection-update:${m.moduleName}`, true);
        }
        if (m.moduleName === 'communications') {
          this.syncCommunicationsLegacyClients(true, emitter, m.url);
        }
      });
    });
    emitter.on('core-status-update', () => {
      this.connectToCore()
        .then(() => {
          this._initialize();
        })
        .catch(() => {
          process.exit(-1);
        });
    });
  }

  monitorModule(
    moduleName: string,
    callback: (serving: boolean) => void,
    wait: boolean = true,
  ) {
    const waitPromise = wait ? this.waitForExistence(moduleName) : Promise.resolve();
    waitPromise
      .then(() => this._modules[moduleName]?.healthClient?.check({}))
      .then(res => {
        callback(res?.status === HealthCheckResponse_ServingStatus.SERVING);
      })
      .catch(() => {
        callback(false);
      })
      .then(() => {
        const emitter = this.config.getModuleWatcher();
        const event = `module-connection-update:${moduleName}`;
        emitter.on(event, callback);
        let set = this._moduleMonitorListeners.get(moduleName);
        if (!set) {
          set = new Set();
          this._moduleMonitorListeners.set(moduleName, set);
        }
        set.add(callback);
      });
  }

  unmonitorModule(moduleName: string) {
    const emitter = this.config.getModuleWatcher();
    const event = `module-connection-update:${moduleName}`;
    const set = this._moduleMonitorListeners.get(moduleName);
    if (set) {
      for (const cb of set) {
        emitter.off(event, cb);
      }
      this._moduleMonitorListeners.delete(moduleName);
    }
  }

  async awaitPeer(moduleName: string, options?: AwaitPeerOptions): Promise<void> {
    const onlyIfServing = options?.onlyIfServing ?? true;
    if (this.isAvailable(moduleName)) return;
    if (options?.timeoutMs != null) {
      await Promise.race([
        this.waitForExistence(moduleName, onlyIfServing),
        sleep(options.timeoutMs).then(() => {
          throw new GrpcError(
            status.DEADLINE_EXCEEDED,
            `awaitPeer(${moduleName}) timed out after ${options.timeoutMs}ms`,
          );
        }),
      ]);
      return;
    }
    await this.waitForExistence(moduleName, onlyIfServing);
  }

  watchPeer(
    moduleName: string,
    handler: (serving: boolean) => void,
    options?: PeerWatchOptions,
  ): () => void {
    const edge = options?.edge ?? 'both';
    const dedupe = options?.dedupe ?? (edge === 'rising' || edge === 'falling');
    let last: boolean | undefined;
    const event = `module-connection-update:${moduleName}`;
    const emitter = this.config.getModuleWatcher();

    const listener = (serving: boolean) => {
      if (dedupe && last === serving) return;
      let fire = false;
      if (edge === 'both') {
        fire = true;
      } else if (edge === 'rising') {
        fire = serving === true && last !== true;
      } else {
        fire = serving === false && last !== false;
      }
      last = serving;
      if (fire) handler(serving);
    };

    let attached = false;
    const attach = () => {
      if (attached) return;
      attached = true;
      emitter.on(event, listener);
    };

    if (options?.syncInitialState !== false) {
      Promise.resolve()
        .then(() => this._modules[moduleName]?.healthClient?.check({}))
        .then(res => {
          const serving = res?.status === HealthCheckResponse_ServingStatus.SERVING;
          last = serving;
          let fire = false;
          if (edge === 'both') fire = true;
          else if (edge === 'rising') fire = serving === true;
          else fire = serving === false;
          if (fire) handler(serving);
        })
        .catch(() => {
          last = false;
          if (edge === 'both' || edge === 'falling') handler(false);
        })
        .finally(() => attach());
    } else {
      attach();
    }

    return () => {
      emitter.off(event, listener);
    };
  }

  oncePeerUp(moduleName: string, callback: () => void | Promise<void>): () => void {
    let done = false;
    const dispose = this.watchPeer(
      moduleName,
      () => {
        if (done) return;
        done = true;
        dispose();
        void Promise.resolve(callback());
      },
      { edge: 'rising', syncInitialState: true },
    );
    return () => {
      if (done) return;
      done = true;
      dispose();
    };
  }

  getKnownModuleNames(): string[] {
    return Object.keys(this._availableModules);
  }

  watchPeers(
    specs: PeerWatchSpec[],
    handler: (statuses: Record<string, boolean>) => void,
    options?: PeerWatchBatchOptions,
  ): () => void {
    if (specs.length === 0) {
      return () => {};
    }
    const debounceMs = options?.debounceMs ?? 100;
    const syncInitial = options?.syncInitialState !== false;
    const statuses: Record<string, boolean> = {};
    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      timer = null;
      handler({ ...statuses });
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, debounceMs);
    };

    const disposers = specs.map(spec =>
      this.watchPeer(
        spec.module,
        serving => {
          statuses[spec.module] = serving;
          schedule();
        },
        { edge: spec.edge ?? 'both', syncInitialState: syncInitial },
      ),
    );

    return () => {
      for (const d of disposers) {
        d();
      }
      if (timer) clearTimeout(timer);
    };
  }

  initializeEventBus(): Promise<EventBus> {
    let promise = Promise.resolve();
    if (process.env.REDIS_CONFIG) {
      this._redisDetails = getJsonEnv('REDIS_CONFIG');
    } else if (process.env.REDIS_HOST && process.env.REDIS_PORT) {
      this._redisDetails = {
        host: process.env.REDIS_HOST!,
        port: parseInt(process.env.REDIS_PORT!, 10),
        db: parseInt(process.env.REDIS_DB!, 10) || 0,
        ...(process.env.REDIS_USERNAME ? { username: process.env.REDIS_USERNAME } : {}),
        ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
      };
    } else {
      promise = promise
        .then(() => this.config.getRedisDetails())
        .then(r => {
          if (r.standalone) {
            this._redisDetails = r.standalone;
          } else {
            this._redisDetails = r.cluster!;
          }
        });
    }
    return promise
      .then(() => {
        if (this._redisDetails!.hasOwnProperty('nodes')) {
          this._redisManager = new RedisManager(this._redisDetails);
        } else {
          const redisHost = (this._redisDetails as RedisOptions).host;
          this._redisManager = new RedisManager({
            ...this._redisDetails,
            host: redisHost,
          });
        }
        this._eventBus = new EventBus(this._redisManager);
        this._stateManager = new StateManager(this._redisManager, this.name);
        return this._eventBus;
      })
      .catch((err: Error) => {
        ConduitGrpcSdk.Logger.error('Failed to initialize event bus');
        throw err;
      });
  }

  /**
   * Gets all the registered modules from the config and creates clients for them.
   * This will only work on known modules, since the primary usage for the sdk is internal
   */
  initializeModules() {
    return this._config!.moduleList()
      .then(r => {
        const emitter = this.config.getModuleWatcher();
        this.lastSearch = Date.now();
        r.forEach(m => {
          this.createModuleClient(m.moduleName, m.url);
          emitter.emit(`module-connection-update:${m.moduleName}`, m.serving);
          if (m.moduleName === 'communications') {
            this.syncCommunicationsLegacyClients(m.serving, emitter, m.url);
          }
        });
        return 'ok';
      })
      .catch(err => {
        if (err.code !== 5) {
          ConduitGrpcSdk.Logger.error(err);
        }
      });
  }

  updateModuleHealth(moduleName: string, serving: boolean) {
    const emitter = this.config.getModuleWatcher();
    emitter.emit(`module-connection-update:${moduleName}`, serving);
  }

  createModuleClient(moduleName: string, moduleUrl: string) {
    moduleUrl = this.resolveModuleUrl(moduleUrl);
    if (this._modules[moduleName]) {
      if (moduleName === 'communications') {
        this.createCommunicationsLegacyClients(moduleUrl);
      }
      return;
    }
    if (this._availableModules[moduleName]) {
      ConduitGrpcSdk.Logger.info(`Creating gRPC client for ${moduleName}`);
      this._modules[moduleName] = new this._availableModules[moduleName](
        this.name,
        moduleUrl,
        this._grpcToken,
      );
    } else if (this._dynamicModules[moduleName]) {
      ConduitGrpcSdk.Logger.info(`Creating gRPC client for ${moduleName}`);
      this._modules[moduleName] = new ConduitModule(
        this.name,
        moduleName,
        moduleUrl,
        this._grpcToken,
      );
      this._modules[moduleName].initializeClient(this._dynamicModules[moduleName]);
    } else {
      // when the module is not "preloaded" by the sdk, and is not a dynamic module,
      // we create a generic module using the ConduitModuleDefinitions
      this._modules[moduleName] = new ConduitModule(
        this.name,
        moduleName,
        moduleUrl,
        this._grpcToken,
      );
      this._modules[moduleName].initializeClient(ConduitModuleDefinition);
    }

    if (moduleName === 'communications') {
      this.createCommunicationsLegacyClients(moduleUrl);
    }
  }

  private resolveModuleUrl(moduleUrl: string) {
    return (
      this.urlRemap?.[moduleUrl] ??
      (this.urlRemap?.['*']
        ? `${this.urlRemap['*']}:${moduleUrl.split(':')[1]}`
        : moduleUrl)
    );
  }

  private createCommunicationsLegacyClients(moduleUrl: string) {
    for (const legacyModule of COMMUNICATIONS_LEGACY_MODULES) {
      if (!this._modules[legacyModule] && this._availableModules[legacyModule]) {
        ConduitGrpcSdk.Logger.info(`Creating gRPC client for ${legacyModule}`);
        this._modules[legacyModule] = new this._availableModules[legacyModule](
          this.name,
          moduleUrl,
          this._grpcToken,
        );
      }
    }
  }

  private syncCommunicationsLegacyClients(
    serving: boolean,
    emitter: ReturnType<Config['getModuleWatcher']>,
    moduleUrl?: string,
  ) {
    if (serving && moduleUrl) {
      this.createCommunicationsLegacyClients(this.resolveModuleUrl(moduleUrl));
    }
    for (const legacyModule of COMMUNICATIONS_LEGACY_MODULES) {
      if (serving) {
        this._modules[legacyModule]?.openConnection();
      } else {
        this._modules[legacyModule]?.closeConnection();
      }
      if (this._communicationsLegacyConnectionStates.get(legacyModule) !== serving) {
        this._communicationsLegacyConnectionStates.set(legacyModule, serving);
        emitter.emit(`module-connection-update:${legacyModule}`, serving);
      }
    }
  }

  isModuleUp(moduleName: string, moduleUrl: string, service: string = '') {
    return checkModuleHealth(moduleName, moduleUrl, service, this._grpcToken);
  }

  moduleClient(name: string, type: CompatServiceDefinition): void {
    this._dynamicModules[name] = type;
  }

  getModule<T extends CompatServiceDefinition>(
    name: string,
  ): ConduitModule<T> | undefined {
    return this._modules[name];
  }

  getServiceClient<T extends CompatServiceDefinition>(
    name: string,
  ): Client<T> | undefined {
    return this._modules[name]?.client;
  }

  getModuleClient(name: string): Client<ConduitModuleDefinition> | undefined {
    return this._modules[name]?.moduleClient;
  }

  getHealthClient<T extends CompatServiceDefinition>(
    name: string,
  ): Client<typeof HealthDefinition> | undefined {
    return this._modules[name]?.healthClient;
  }

  isAvailable(moduleName: string) {
    return !!this._modules[moduleName]?.active;
  }

  async waitForExistence(moduleName: string, onlyIfServing: boolean = true) {
    if (this.isAvailable(moduleName)) return true;
    const emitter = this.config.getModuleWatcher();
    return new Promise(resolve => {
      const listener = (serving: boolean) => {
        if (!onlyIfServing || (onlyIfServing && serving)) {
          emitter.removeListener(`module-connection-update:${moduleName}`, listener);
          return resolve(true);
        }
      };
      emitter.on(`module-connection-update:${moduleName}`, listener);
    });
  }

  onceModuleUp(moduleName: string, callback: () => void) {
    if (this.isAvailable(moduleName)) callback();
    const emitter = this.config.getModuleWatcher();
    emitter.once(`module-connection-update:${moduleName}`, (serving: boolean) =>
      serving ? callback() : null,
    );
  }

  onceModuleDown(moduleName: string, callback: () => void) {
    const emitter = this.config.getModuleWatcher();
    emitter.once(`module-connection-update:${moduleName}`, (serving: boolean) =>
      serving ? null : callback(),
    );
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

  private _initialize() {
    if (this._initialized) {
      this._config?.openConnection();
      this._admin?.openConnection();
      this.config.watchModules().then();
      return;
    }
    (this._config as unknown) = new Config(
      this.name,
      this.serverUrl,
      this._serviceHealthStatusGetter,
      this._grpcToken,
    );
    (this._admin as unknown) = new Admin(this.name, this.serverUrl, this._grpcToken);
    if (this.name !== 'core') {
      this.initializeModules().then();
    }
    if (this._watchModules) {
      this.watchModules();
    }
    this._initialized = true;
  }
}

export { ConduitGrpcSdk };
export type { CountDocumentsOptions } from './modules/database/index.js';
export type { FindManyOptions, FindOneOptions } from './modules/database/types.js';
export * from './interfaces/index.js';
export * from './classes/index.js';
export * from './modules/index.js';
export * from './constants/index.js';
export * from './types/index.js';
export * from './protoUtils/index.js';
export * from '@grpc/grpc-js';
