import {isNil} from 'lodash';
import {Config} from 'convict';

export class DatabaseConfigUtility {
    constructor(private readonly database: any, private readonly appConfig: Config<any>) {
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
}
