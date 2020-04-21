import { isNil } from 'lodash';
import { IConduitDatabase } from '@conduit/sdk';
import { Config } from 'convict';

export class DatabaseConfigUtility {
  constructor(
    private readonly database: IConduitDatabase,
    private readonly appConfig: Config<any>
  ) {
  }

  async configureFromDatabase() {
    let dbConfig = await this.database.getSchema('Config').findOne({});

    if (isNil(dbConfig)) {
      const appConfig = this.appConfig.get();
      const configToCreate: { [key: string]: any } = {};
      Object.keys(appConfig).forEach(key => {
        if (appConfig[key].active === false) return;
        configToCreate[key] = appConfig[key];
      });
      dbConfig = this.database.getSchema('Config').create(configToCreate);
    }

    delete dbConfig._id;
    delete dbConfig.createdAt;
    delete dbConfig.updatedAt;
    delete dbConfig.__v;

    this.appConfig.load(dbConfig);
  }
}
