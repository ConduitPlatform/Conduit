import {Config} from 'convict';
import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';

export class DatabaseConfigUtility {
    constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    }

    async registerConfigSchemas(newConfig: any): Promise<any> {
        await this.grpcSdk.waitForExistence('database-provider'); // for some reason if we remove this line database is null
        const database = this.grpcSdk.databaseProvider;
        return database!.createSchemaFromAdapter(newConfig)
            .then(r => {
                return database!.findOne('Config', {});
            })
            .then(r => {
                if (!r) database!.create('Config', {});
            });
    }

}
