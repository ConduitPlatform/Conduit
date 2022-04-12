import { Config } from 'convict';

export abstract class IConfigManager {
  abstract getDatabaseConfigUtility(): IDatabaseConfigUtility;
  abstract initConfigAdminRoutes(): void;
  abstract registerAppConfig(): Promise<any>;
  abstract registerModulesConfig(moduleName: string, moduleConfig: any): Promise<any>;
  abstract get(moduleName: string): Promise<any>;
  abstract set(moduleName: string, moduleConfig: any): Promise<any>;
  abstract addFieldsToModule(moduleName: string, moduleConfig: any): Promise<any>;
  abstract getModuleUrlByName(moduleName: string): string | undefined;
}

export abstract class IDatabaseConfigUtility {
  abstract registerConfigSchemas(newConfig: any): Promise<any>;
}

export abstract class IAppConfig {
  abstract get config(): Config<any>;

  abstract get configSchema(): any;
}
