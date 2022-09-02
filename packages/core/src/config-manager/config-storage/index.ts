import { ConduitCommons } from '@conduitplatform/commons';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { clearInterval } from 'timers';
import * as models from '../models';
import { ServiceDiscovery } from '../service-discovery';

export class ConfigStorage {
  toBeReconciled: string[] = [];
  reconciling: boolean = false;
  private configDocId: string | null = null;

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
    let configDoc: models.Config | null = await this.grpcSdk.database!.findOne(
      'Config',
      {},
    );
    if (!configDoc) {
      configDoc = await models.Config.getInstance().create({});
      configDoc['moduleConfigs'] = {};
      for (const key in this.serviceDiscovery.registeredModules.keys()) {
        try {
          configDoc.moduleConfigs[key] = await this.getConfig(key, false);
        } catch {}
      }
      for (const key of ['core', 'admin']) {
        try {
          configDoc.moduleConfigs[key] = await this.getConfig(key, false);
        } catch {}
      }
      // flush redis stored configuration to the database
      if (Object.keys(configDoc.moduleConfigs).length > 0) {
        await models.Config.getInstance().findByIdAndUpdate(configDoc._id, {
          moduleConfigs: configDoc.moduleConfigs,
        });
      }
    } else {
      // patch database with new config keys
      for (const key of Object.keys(configDoc.moduleConfigs)) {
        let redisConfig;
        try {
          redisConfig = await this.getConfig(key, false);
          redisConfig = { ...redisConfig, ...configDoc!.moduleConfigs[key] };
          configDoc!.moduleConfigs[key] = redisConfig;
        } catch (e) {
          redisConfig = configDoc!.moduleConfigs[key];
        }
        await this.setConfig(key, JSON.stringify(redisConfig), false);
      }
      await models.Config.getInstance().findByIdAndUpdate(configDoc._id, {
        moduleConfigs: configDoc.moduleConfigs,
      });
    }
    this.configDocId = configDoc._id;
    // Update Admin and all active modules
    this.commons.getAdmin().handleConfigUpdate(configDoc.moduleConfigs.admin);
    const registeredModules = Array.from(this.serviceDiscovery.registeredModules.keys());
    for (const [module, config] of Object.entries(configDoc.moduleConfigs)) {
      if (module === 'core' || module === 'admin') continue;
      if (registeredModules.includes(module)) {
        this.grpcSdk.bus!.publish(`${module}:config:update`, JSON.stringify(config));
      }
    }
  }

  reconcileMonitor() {
    const reconciliationInterval = setInterval(() => {
      if (this.grpcSdk.isAvailable('database') && this.toBeReconciled.length > 0) {
        this.reconcile();
      }
      // add a random extra amount to mitigate race-conditions,
      // between core instances
    }, 1500 + Math.floor(Math.random() * 300));

    process.on('exit', () => {
      clearInterval(reconciliationInterval);
    });
  }

  reconcile() {
    this.changeState(true);
    const promises = this.toBeReconciled.map(moduleName => {
      return this.getConfig(moduleName, false).then(config =>
        models.Config.getInstance().findByIdAndUpdate(this.configDocId!, {
          $set: { [`moduleConfigs.${moduleName}`]: config },
        }),
      );
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
