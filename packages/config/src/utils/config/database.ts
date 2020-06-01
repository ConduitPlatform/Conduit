import {isNil} from 'lodash';
import {Config} from 'convict';
import { IDatabaseConfigUtility } from '@conduit/sdk';
import ConduitGrpcSdk from '@conduit/grpc-sdk';

export class DatabaseConfigUtility {
    constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    }

    async registerConfigSchemas(newConfig: any): Promise<any> {
        await this.grpcSdk.waitForExistence('database-provider'); // for some reason if we remove this line database is null
        const database = this.grpcSdk.databaseProvider;
        if (isNil(newConfig.name)) {
            let ConfigSchema = await database!.getSchema('Config');
            ConfigSchema = {
                name: ConfigSchema.name,
                modelSchema: JSON.parse(ConfigSchema.modelSchema),
                modelOptions: JSON.parse(ConfigSchema.modelOptions)
            }
            Object.assign(ConfigSchema.modelSchema, newConfig);

            return database!.createSchemaFromAdapter(ConfigSchema);
        }
        return database!.createSchemaFromAdapter(newConfig);
    }

    // async configureFromDatabase() {
    //     let dbConfig = await this.database.findOne('Config', {});
    //
    //     if (isNil(dbConfig)) {
    //         const appConfig = this.grpcSdk.config.get();
    //         const configToCreate: { [key: string]: any } = {};
    //         Object.keys(appConfig).forEach(key => {
    //             if (appConfig[key].active === false) return;
    //             configToCreate[key] = appConfig[key];
    //         });
    //         dbConfig = await this.database.create('Config', configToCreate);
    //     }
    //
    //     delete dbConfig._id;
    //     delete dbConfig.createdAt;
    //     delete dbConfig.updatedAt;
    //     delete dbConfig.__v;
    //
    //     this.appConfig.load(dbConfig);
    // }

    async updateDbConfig(newConfig: any) {
        await this.grpcSdk.waitForExistence('database-provider'); // for some reason if we remove this line database is null
        const database = this.grpcSdk.databaseProvider;
        let dbConfig = await database!.findOne('Config', {});
        await database!.findByIdAndUpdate('Config', dbConfig);
        // Object.keys(newConfig).forEach(key => {
        //     dbConfig[key] = newConfig[key];
        // })
        // dbConfig = await database!.findByIdAndUpdate('Config', dbConfig);
        // delete dbConfig._id;
        // delete dbConfig.createdAt;
        // delete dbConfig.updatedAt;
        // delete dbConfig.__v;
        // return dbConfig;
    }
}
