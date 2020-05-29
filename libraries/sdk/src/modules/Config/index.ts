import { Config } from 'convict';

export abstract class IConfigManager {
  abstract getDatabaseConfigUtility(appConfig: any): IDatabaseConfigUtility;
  // abstract get appConfig(): IAppConfig;
  abstract initConfigAdminRoutes(): void;
  abstract registerAppConfig(): Promise<any>;
  abstract registerConfigSchemas(newConfig: any): Promise<any>;
  abstract registerModulesConfig(newModulesConfigSchemaFields: any): Promise<any>;

}

export abstract class IDatabaseConfigUtility {
  constructor(database: any, appConfig: Config<any>) {
  }

  abstract async configureFromDatabase(): Promise<any>;
  abstract async updateDbConfig(): Promise<any>;
}

export abstract class IAppConfig {
  abstract get config(): Config<any>;

  abstract get configSchema(): any;
}
