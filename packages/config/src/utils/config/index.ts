import path from 'path';
import convict, { Config } from 'convict';
import AppConfigSchema from './schema/app';
import { isNil } from 'lodash';
import { ConduitSDK } from '@conduit/sdk';
// import AdminModule from '@conduit/admin';
//  config import needs to be changed
// import AuthenticationModule from '@conduit/authentication';
// import AdminModule from '@conduit/admin';
// import EmailModule from '@conduit/email';
// import StorageModule from '@conduit/storage';
// import InMemoryStore from '@conduit/in-memory-store';
// import PushNotificationsModule from '@conduit/push-notifications';

export class AppConfig {
  private static instance: AppConfig;
  private readonly convictConfig: Config<any>;
  private completeConfigSchema: any;

  static getInstance() {
    if (isNil(AppConfig.instance)) {
      AppConfig.instance = new AppConfig();
    }
    return AppConfig.instance;
  }

  get config() {
    return this.convictConfig;
  }

  get configSchema() {
    return this.completeConfigSchema;
  }

  private constructor() {
    this.completeConfigSchema = this.mergeSchemas();
    this.convictConfig = convict(this.completeConfigSchema);
    this.loadConfig();
    this.validateConfig();
    this.injectEnvironmentVariables();
  }

  // const AuthenticationConfigSchema = AuthenticationModule.config;

  private mergeSchemas() {
    return {
      ...AppConfigSchema,
      // config import needs to be changed
      // ...AuthenticationModule.config,
      // ...EmailModule.config,
      // ...StorageModule.config,
      // ...InMemoryStore.config,
      // ...PushNotificationsModule.config,
      // ...AdminModule.config
    };
  }

  private loadConfig() {
    this.convictConfig.loadFile(path.join(__dirname, '../../../config/env.json'));
  }

  private validateConfig() {
    // todo maybe change  back to strict but i think strict might not be possible
    this.convictConfig.validate({ allowed: 'warn' });
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
