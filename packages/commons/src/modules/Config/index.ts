import { Config } from 'convict';

export abstract class IConfigManager {
  abstract initConfigAdminRoutes(): void;
  abstract registerAppConfig(): Promise<any>;
  abstract registerModulesConfig(moduleName: string, moduleConfig: any): Promise<any>;
  abstract get(moduleName: string): Promise<any>;
  abstract set(moduleName: string, moduleConfig: any): Promise<any>;
  abstract addFieldsToModule(moduleName: string, moduleConfig: any): Promise<any>;
  abstract getModuleUrlByName(moduleName: string): string | undefined;
}

export abstract class IAppConfig {
  abstract get config(): Config<any>;
  abstract get configSchema(): any;
}
