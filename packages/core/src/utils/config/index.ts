import path from 'path';
import convict, { Config } from 'convict';
import AppConfigSchema from './schema/app';
import { isNil } from 'lodash';
import AuthenticationModule from '@conduit/authentication';
import AdminModule from '@conduit/admin';
import EmailModule from '@conduit/email';
import StorageModule from '@conduit/storage';
import InMemoryStore from '@conduit/in-memory-store';
import PushNotificationsModule from '@conduit/push-notifications';

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

  // const AuthenticationConfigSchema = AuthenticationModule.config;

  private mergeSchemas() {
    return {
      ...AppConfigSchema,
      ...AuthenticationModule.config,
      ...EmailModule.config,
      ...StorageModule.config,
      ...InMemoryStore.config,
      ...PushNotificationsModule.config,
      ...AdminModule.config
    };
  }

  private loadConfig() {
    this.convictConfig.loadFile(path.join(__dirname, '../../../config/env.json'));
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
