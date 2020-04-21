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
    // TODO figure out a scalable way to generate the mongoose schema
    let dbConfig = await this.database.getSchema('Config').findOne({});

    if (isNil(dbConfig)) {
      return this.database.getSchema('Config').create({config: this.appConfig.get()});
    }

    this.appConfig.load(dbConfig.config);
  }
}
