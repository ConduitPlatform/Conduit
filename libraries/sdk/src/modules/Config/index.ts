export abstract class IConfigManager {
  abstract getDatabaseConfigUtility(appConfig: any): IDatabaseConfigUtility;
  abstract get appConfig(): IAppConfig;

}

export abstract class IDatabaseConfigUtility {
  constructor(private readonly database: any, private readonly appConfig: any) {
  }

  abstract async configureFromDatabase(): Promise<any>;
}

export abstract class IAppConfig {
  abstract get config(): any

  abstract get configSchema(): any;
}
