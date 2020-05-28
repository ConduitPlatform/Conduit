import { Config } from 'convict';

export abstract class IConfigManager {
  abstract getDatabaseConfigUtility(appConfig: any): IDatabaseConfigUtility;
  abstract get appConfig(): IAppConfig;
  abstract initConfigAdminRoutes(): void;
  abstract registerConfigSchemas(): Promise<any>;
  abstract registerModulesConfig(name: string, newModulesConfigSchema: any): Promise<any>;

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
