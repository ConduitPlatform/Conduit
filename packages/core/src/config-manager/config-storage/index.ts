import { ConduitCommons } from '@conduitplatform/commons';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { clearInterval } from 'timers';
import * as models from '../models';
import { ServiceDiscovery } from '../service-discovery';

export class ConfigStorage {
  reconcileTimeout: NodeJS.Timeout | null;
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
        console.log('Reconciliation with db successful');
        this.changeState(false);
        this.reconcileMonitor();
      })
      .catch(err => {
        this.changeState(false);
        console.error('Reconciliation with db failed!');
      });
  }

  highAvailability() {
    this.commons.getBus().subscribe('config', (message: string) => {
      if (message === 'reconciling') {
        this.reconciling = true;
      } else if (message === 'reconcile-done') {
        this.reconciling = false;
      }
    });
  }

  changeState(reconciling: boolean) {
    this.commons
      .getBus()
      .publish('config', reconciling ? 'reconciling' : 'reconcile-done');
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
          configDoc.moduleConfigs[key] = this.getConfig(key, false);
        } catch {}
      }
      for (const key of ['core', 'admin']) {
        try {
          configDoc.moduleConfigs[key] = this.getConfig(key, false);
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
      Object.keys(configDoc.moduleConfigs).forEach(key => {
        let redisConfig = this.getConfig(key, false);
        redisConfig = { ...redisConfig, ...configDoc!.moduleConfigs[key] };
        configDoc!.moduleConfigs[key] = redisConfig;
        this.setConfig(key, JSON.stringify(redisConfig), false);
      });
      await models.Config.getInstance().findByIdAndUpdate(configDoc._id, {
        moduleConfigs: configDoc.moduleConfigs,
      });
    }
    this.configDocId = (configDoc as any)._id;
  }

  clearReconcile() {
    clearTimeout(this.reconcileTimeout!);
    this.reconcileTimeout = null;
  }

  reconcileMonitor() {
    let reconciliationInterval = setInterval(() => {
      if (this.grpcSdk.isAvailable('database') && this.toBeReconciled.length > 0) {
        this.reconcile();
      }
    }, 1500 + Math.floor(Math.random() * 300));

    process.on('exit', () => {
      this.clearReconcile();
      clearInterval(reconciliationInterval);
    });
  }

  reconcile() {
    this.changeState(true);
    let promises = this.toBeReconciled.map(moduleName => {
      return this.getConfig(moduleName, false).then(config =>
        models.Config.getInstance().findByIdAndUpdate(this.configDocId!, {
          $set: { [`moduleConfigs.${moduleName}`]: config },
        }),
      );
    });
    Promise.all(promises)
      .then(() => {
        console.log('Module configurations reconciled!');
        this.toBeReconciled = [];
        this.changeState(false);
      })
      .catch(e => {
        console.error('Module configurations failed to reconcile!');
        console.error(e);
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

    let config: string | null = await this.commons
      .getState()
      .getKey(`moduleConfigs.${moduleName}`);
    if (!config) throw new Error('Config not found for ' + moduleName);
    return JSON.parse(config);
  }

  async setConfig(moduleName: string, config: string, waitReconcile: boolean = true) {
    if (waitReconcile) {
      await this.waitForReconcile();
    }
    await this.commons.getState().setKey(`moduleConfigs.${moduleName}`, config);
    if (!this.toBeReconciled.includes(moduleName)) {
      this.toBeReconciled.push(moduleName);
    }
  }
}
