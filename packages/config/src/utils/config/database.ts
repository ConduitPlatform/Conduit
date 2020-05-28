import {isNil} from 'lodash';
import {Config} from 'convict';
import { IDatabaseConfigUtility } from '@conduit/sdk';

export class DatabaseConfigUtility extends IDatabaseConfigUtility{
    constructor(private readonly database: any, private readonly appConfig: Config<any>) {
        super(database, appConfig);
    }

    async configureFromDatabase() {
        let dbConfig = await this.database.findOne('Config', {});

        if (isNil(dbConfig)) {
            const appConfig = this.appConfig.get();
            const configToCreate: { [key: string]: any } = {};
            Object.keys(appConfig).forEach(key => {
                if (appConfig[key].active === false) return;
                configToCreate[key] = appConfig[key];
            });
            dbConfig = await this.database.create('Config', configToCreate);
        }

        delete dbConfig._id;
        delete dbConfig.createdAt;
        delete dbConfig.updatedAt;
        delete dbConfig.__v;

        this.appConfig.load(dbConfig);
    }

    async updateDbConfig() {
        let dbConfig = await this.database.findOne('Config', {});
        const appConfig = this.appConfig.get();
        Object.keys(appConfig).forEach(key => {
            dbConfig[key] = appConfig[key];
        })
        dbConfig = await this.database.findByIdAndUpdate('Config', dbConfig);
        delete dbConfig._id;
        delete dbConfig.createdAt;
        delete dbConfig.updatedAt;
        delete dbConfig.__v;
        this.appConfig.load(dbConfig);
    }
}
