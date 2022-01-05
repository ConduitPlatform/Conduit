import { Config } from 'convict';
import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';

export class DatabaseConfigUtility {
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  async registerConfigSchemas(newConfig: any): Promise<any> {
    const database = this.grpcSdk.databaseProvider;
    return database!
      .createSchemaFromAdapter(newConfig)
      .then(() => {
        return database!.findOne('Config', {});
      })
      .then((r) => {
        if (!r) return database!.create('Config', {});
      });
  }
}
