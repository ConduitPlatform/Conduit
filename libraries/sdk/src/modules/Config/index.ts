import { Config } from 'convict';

export abstract class IConfigManager {
  abstract getDatabaseConfigUtility(): IDatabaseConfigUtility;
  abstract initConfigAdminRoutes(): void;
  abstract registerAppConfig(): Promise<any>;
  abstract registerModulesConfig(name: string, newModulesConfigSchemaFields: any): Promise<any>;
  abstract get(name: string): Promise<any>;
  abstract addFieldsToModule(name: string, newModulesConfigSchemaFields: any): Promise<any>;
  abstract set(name: string, newModulesConfigSchemaFields: any): Promise<any>;
  abstract getModuleUrlByInstance(instancePeer: string): string | undefined;

}

export abstract class IDatabaseConfigUtility {
  abstract registerConfigSchemas(newConfig: string): Promise<any>;
}

export abstract class IAppConfig {
  abstract get config(): Config<any>;

  abstract get configSchema(): any;
}
