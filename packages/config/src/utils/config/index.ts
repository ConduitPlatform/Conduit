import path from 'path';
import convict, { Config } from 'convict';
import AppConfigSchema from './schema/config';
import { isNil } from 'lodash';
import { IAppConfig } from '@quintessential-sft/conduit-sdk';

export class AppConfig implements IAppConfig {
  private static instance: AppConfig;
  private convictConfig: Config<any>;
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
    this.completeConfigSchema = AppConfigSchema;
    this.convictConfig = convict(this.completeConfigSchema);
    this.loadConfig();
    this.validateConfig();
    this.injectEnvironmentVariables();
  }

  addModulesConfigSchema(moduleConfigSchema: any) {
    this.completeConfigSchema = { ...this.completeConfigSchema, ...moduleConfigSchema };
    this.convictConfig = convict(this.completeConfigSchema);
    this.loadConfig();
    this.validateConfig();
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
