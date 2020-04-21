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
      dbConfig = this.database.getSchema('Config').create(this.appConfig.get());
    }

    delete dbConfig._id;
    delete dbConfig.createdAt;
    delete dbConfig.updatedAt;
    delete dbConfig.__v;

    this.appConfig.load(dbConfig);
  }
}
