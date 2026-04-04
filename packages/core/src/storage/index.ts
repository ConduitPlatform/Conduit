// Removed ConduitCommons import - now using core directly
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import * as models from '../models/index.js';
import { ServiceDiscovery } from '../service-discovery/index.js';
import { clearInterval } from 'timers';
import { ServiceRegistry } from '../service-discovery/ServiceRegistry.js';

export type ConfigVersionMeta = { version: number; explicit: boolean };

export class ConfigStorage {
  toBeReconciled: string[] = [];
  reconciling: boolean = false;

  constructor(
    private readonly core: any,
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly serviceDiscovery: ServiceDiscovery,
  ) {
    this.highAvailability();
  }

  onDatabaseAvailable() {
    this.firstSync()
      .then(() => {
        ConduitGrpcSdk.Logger.log('Reconciliation with db successful');
        this.changeState(false);
        this.reconcileMonitor();
      })
      .catch(() => {
        this.changeState(false);
        ConduitGrpcSdk.Logger.error('Reconciliation with db failed!');
      });
  }

  highAvailability() {
    this.grpcSdk.bus!.subscribe('config', (message: string) => {
      if (message === 'reconciling') {
        this.reconciling = true;
      } else if (message === 'reconcile-done') {
        this.reconciling = false;
      }
    });
  }

  changeState(reconciling: boolean) {
    this.reconciling = reconciling;
    this.grpcSdk.bus!.publish('config', reconciling ? 'reconciling' : 'reconcile-done');
  }

  versionKey(moduleName: string) {
    return `moduleConfigs.${moduleName}:version`;
  }

  async getConfigVersionMeta(moduleName: string): Promise<ConfigVersionMeta> {
    const raw = await this.grpcSdk.state!.getKey(this.versionKey(moduleName));
    if (raw == null || raw === '') {
      return { version: 0, explicit: false };
    }
    const parsed = parseInt(String(raw), 10);
    return { version: Number.isFinite(parsed) ? parsed : 0, explicit: true };
  }

  async getConfigVersion(moduleName: string): Promise<number> {
    const meta = await this.getConfigVersionMeta(moduleName);
    return meta.version;
  }

  async firstSync() {
    this.changeState(true);
    const configDocs = await models.Config.getInstance().findMany({});
    if (configDocs.length === 0) {
      // flush redis stored configuration to the database
      let moduleConfig;
      for (const key of ServiceRegistry.getInstance().getRegisteredModules()) {
        try {
          moduleConfig = await this.getConfig(key, false);
          const version = await this.getConfigVersion(key);
          await models.Config.getInstance().create({
            name: key,
            config: moduleConfig,
            version,
          });
        } catch {}
      }
      for (const key of ['core', 'admin']) {
        try {
          moduleConfig = await this.getConfig(key, false);
          const version = await this.getConfigVersion(key);
          await models.Config.getInstance().create({
            name: key,
            config: moduleConfig,
            version,
          });
        } catch {}
      }
    } else {
      for (const config of configDocs) {
        const dbVersion = config.version ?? 0;
        let redisVersion = 0;
        let redisConfig: unknown;
        try {
          redisConfig = await this.getConfig(config.name, false);
          redisVersion = await this.getConfigVersion(config.name);
        } catch {
          redisConfig = null;
        }

        if (!redisConfig || dbVersion >= redisVersion) {
          await this.grpcSdk.state!.setKey(
            `moduleConfigs.${config.name}`,
            JSON.stringify(config.config),
          );
          await this.grpcSdk.state!.setKey(
            this.versionKey(config.name),
            String(dbVersion),
          );
        } else {
          await models.Config.getInstance().findByIdAndUpdate(config._id, {
            config: redisConfig,
            version: redisVersion,
          });
        }
      }
    }
    // Update Admin and all active modules
    const registeredModules = ServiceRegistry.getInstance().getRegisteredModules();
    const moduleConfigs = await models.Config.getInstance().findMany({});
    for (const config of moduleConfigs) {
      if (config.name === 'core') continue;
      if (config.name === 'admin') {
        // Note: Admin config updates are handled through the admin module's own subscription
        continue;
      }
      if (registeredModules.includes(config.name)) {
        this.grpcSdk.bus!.publish(
          `${config.name}:config:update`,
          JSON.stringify(config.config),
        );
      }
    }
  }

  reconcileMonitor() {
    const reconciliationInterval = setInterval(
      () => {
        if (this.grpcSdk.isAvailable('database') && this.toBeReconciled.length > 0) {
          this.reconcile();
        }
        // add a random extra amount to mitigate race-conditions,
        // between core instances
      },
      1500 + Math.floor(Math.random() * 300),
    );

    process.on('exit', () => {
      clearInterval(reconciliationInterval);
    });
  }

  reconcile() {
    this.changeState(true);
    const promises = this.toBeReconciled.map(moduleName => {
      return Promise.all([
        this.getConfig(moduleName, false),
        this.getConfigVersion(moduleName),
      ]).then(async ([config, version]) => {
        const moduleConfig = await models.Config.getInstance().findOne({
          name: moduleName,
        });
        if (moduleConfig) {
          await models.Config.getInstance().findByIdAndUpdate(moduleConfig._id, {
            config: config,
            version,
          });
        } else {
          await models.Config.getInstance().create({
            name: moduleName,
            config: config,
            version,
          });
        }
      });
    });
    Promise.all(promises)
      .then(() => {
        ConduitGrpcSdk.Logger.log('Module configurations reconciled!');
        this.toBeReconciled = [];
        this.changeState(false);
      })
      .catch(e => {
        ConduitGrpcSdk.Logger.error('Module configurations failed to reconcile!');
        ConduitGrpcSdk.Logger.error(e);
        this.changeState(false);
      });
  }

  async waitForReconcile() {
    while (this.reconciling) {
      await new Promise(resolve => {
        setTimeout(resolve, 200);
      });
    }
  }

  async getConfig(moduleName: string, waitReconcile: boolean = true) {
    if (waitReconcile) {
      await this.waitForReconcile();
    }

    const config: string | null = await this.grpcSdk.state!.getKey(
      `moduleConfigs.${moduleName}`,
    );
    if (!config) {
      throw new Error('Config not found for ' + moduleName);
    }
    return JSON.parse(config);
  }

  async setConfigAtVersion(
    moduleName: string,
    config: string,
    version: number,
    waitReconcile: boolean = true,
  ) {
    if (waitReconcile) {
      await this.waitForReconcile();
    }
    await this.grpcSdk.state!.setKey(`moduleConfigs.${moduleName}`, config);
    await this.grpcSdk.state!.setKey(this.versionKey(moduleName), String(version));
  }

  async setConfig(moduleName: string, config: string, waitReconcile: boolean = true) {
    if (waitReconcile) {
      await this.waitForReconcile();
    }
    const meta = await this.getConfigVersionMeta(moduleName);
    let currentVersion = meta.version;
    if (this.grpcSdk.isAvailable('database')) {
      const dbDoc = await models.Config.getInstance()
        .findOne({ name: moduleName })
        .catch(() => null);
      if (dbDoc) {
        currentVersion = Math.max(currentVersion, dbDoc.version ?? 0);
      }
    }
    const newVersion = currentVersion + 1;
    await this.grpcSdk.state!.setKey(`moduleConfigs.${moduleName}`, config);
    await this.grpcSdk.state!.setKey(this.versionKey(moduleName), String(newVersion));
    if (!this.toBeReconciled.includes(moduleName) && waitReconcile) {
      this.toBeReconciled.push(moduleName);
    }
  }
}
