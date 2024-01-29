import { IConduitAdmin, IConduitCore, IConfigManager } from './modules/index.js';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

export class ConduitCommons {
  private static _instance: ConduitCommons;
  private _core?: IConduitCore;
  private _admin?: IConduitAdmin;
  private _configManager?: IConfigManager;
  private readonly name: string;

  private constructor(name: string) {
    this.name = name;
    if (
      (!process.env.REDIS_HOST || !process.env.REDIS_PORT) &&
      !process.env.REDIS_CONFIG
    ) {
      ConduitGrpcSdk.Logger.error('Redis config not provided');
      process.exit(-1);
    }
  }

  static getInstance(name: string) {
    if (!this._instance) {
      this._instance = new ConduitCommons(name);
    }
    return this._instance;
  }

  registerCore(core: IConduitCore) {
    if (this._core) throw new Error('Cannot register a second core!');
    this._core = core;
  }

  getCore() {
    if (this._core) return this._core;
    throw new Error('Core not assigned yet!');
  }

  registerAdmin(admin: IConduitAdmin) {
    if (this._admin) throw new Error('Cannot register a second admin!');
    this._admin = admin;
  }

  getAdmin(): IConduitAdmin {
    if (this._admin) return this._admin;
    throw new Error('Admin not assigned yet!');
  }

  registerConfigManager(configManager: IConfigManager) {
    if (this._configManager) throw new Error('Cannot register a second config manager');
    this._configManager = configManager;
  }

  getConfigManager(): IConfigManager {
    if (this._configManager) return this._configManager;
    throw new Error('Config manager not assigned yet');
  }
}

export * from './interfaces/index.js';
export * from './modules/index.js';
export * from './protoTypes/core.js';
