import { ConduitCommons } from '@conduitplatform/commons';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import * as models from '../models';
import { ServiceDiscovery } from '../service-discovery';
import { clearInterval } from 'timers';
import { merge } from 'lodash';
import { ServiceRegistry } from '../service-discovery/ServiceRegistry';

export class ConfigStorage {
  toBeReconciled: string[] = [];
  reconciling: boolean = false;

  constructor(
    private readonly commons: ConduitCommons,
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

  async firstSync() {
    this.changeState(true);
    const configDocs = await models.Config.getInstance().findMany({});
    if (configDocs.length === 0) {
      // flush redis stored configuration to the database
      let moduleConfig;
      for (const key of ServiceRegistry.getInstance().getRegisteredModules()) {
        try {
          moduleConfig = await this.getConfig(key, false);
          await models.Config.getInstance().create({ name: key, config: moduleConfig });
        } catch {}
      }
      for (const key of ['core', 'admin']) {
        try {
          moduleConfig = await this.getConfig(key, false);
          await models.Config.getInstance().create({ name: key, config: moduleConfig });
        } catch {}
      }
    } else {
      // patch database with new config keys
      for (const config of configDocs) {
        let redisConfig;
        try {
          redisConfig = await this.getConfig(config.name, false);
          redisConfig = merge(redisConfig, config.config);
          await models.Config.getInstance().findByIdAndUpdate(config._id, {
            config: redisConfig,
          });
        } catch (e) {
          redisConfig = config.config;
        }
        await this.setConfig(config.name, JSON.stringify(redisConfig), false);
      }
    }
    // Update Admin and all active modules
    const registeredModules = ServiceRegistry.getInstance().getRegisteredModules();
    const moduleConfigs = await models.Config.getInstance().findMany({});
    for (const config of moduleConfigs) {
      if (config.name === 'core') continue;
      if (config.name === 'admin') {
        this.commons.getAdmin().handleConfigUpdate(config.config);
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
      return this.getConfig(moduleName, false).then(async config => {
        const moduleConfig = await models.Config.getInstance().findOne({
          name: moduleName,
        });
        if (moduleConfig) {
          await models.Config.getInstance().findByIdAndUpdate(moduleConfig._id, {
            config: config,
          });
        } else {
          await models.Config.getInstance().create({ name: moduleName, config: config });
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

  async setConfig(moduleName: string, config: string, waitReconcile: boolean = true) {
    if (waitReconcile) {
      await this.waitForReconcile();
    }
    await this.grpcSdk.state!.setKey(`moduleConfigs.${moduleName}`, config);
    if (!this.toBeReconciled.includes(moduleName) && waitReconcile) {
      this.toBeReconciled.push(moduleName);
    }
  }
}
