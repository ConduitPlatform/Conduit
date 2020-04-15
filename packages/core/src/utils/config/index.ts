import path from 'path';
import convict, { Config } from 'convict';
import AppConfigSchema from './schemas/app';
import AdminConfigSchema from './schemas/admin';
import AuthenticationConfigSchema from './schemas/authentication';
import InMemoryStoreSchema from './schemas/in-memory-store';
import StorageConfigSchema from './schemas/storage';
import PushNotificationsConfigSchema from './schemas/push-notifications';
import EmailConfigSchema from './schemas/email';
import { isNil } from 'lodash';

export class AppConfig {
  private static instance: AppConfig;
  private readonly convictConfig: Config<any>;

  static getInstance() {
    if (isNil(AppConfig.instance)) {
      AppConfig.instance = new AppConfig();
    }
    return AppConfig.instance;
  }

  get config() {
    return this.convictConfig;
  }

  private constructor() {
    this.convictConfig = convict(this.mergeSchemas());
    this.loadConfig();
    this.validateConfig();
    this.injectEnvironmentVariables();
  }

  private mergeSchemas() {
    return {
      ...AppConfigSchema,
      ...AuthenticationConfigSchema,
      ...EmailConfigSchema,
      ...StorageConfigSchema,
      ...InMemoryStoreSchema,
      ...PushNotificationsConfigSchema,
      ...AdminConfigSchema
    };
  }

  private loadConfig() {
    this.convictConfig.loadFile(path.join(__dirname, '../../config/env.json'));
  }

  private validateConfig() {
    this.convictConfig.validate({ allowed: 'strict' });
  }

  private injectEnvironmentVariables() {
    if (process.env.DATABASE_TYPE) {
      process.env.databaseType = process.env.DATABASE_TYPE;
    } else {
      process.env.databaseType = this.convictConfig.get('database').type;
    }

    if (process.env.DATABASE_URL) {
      process.env.databaseURL = process.env.DATABASE_URL;
    } else {
      process.env.databaseURL = this.convictConfig.get('database').databaseURL;
    }
  }
}

export * from './database';
