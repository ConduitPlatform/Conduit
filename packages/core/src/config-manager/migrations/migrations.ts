import ConduitGrpcSdk, { Migration } from '@conduitplatform/grpc-sdk';
import { Config } from '../models';

const ConfigMigration = {
  schemaName: 'Config',
  from: '0.15.0',
  to: '0.16.0',
  up: async (grpcSdk: ConduitGrpcSdk) => {
    const configs: any[] = await Config.getInstance().findMany({});
    if (configs.length === 0 || configs.length > 1) return;
    const id = configs[0]._id;
    for (const [moduleName, newConfig] of Object.entries(configs[0].moduleConfigs)) {
      await Config.getInstance().create({ name: moduleName, config: newConfig });
    }
    await Config.getInstance().deleteOne({ _id: id });
  },
  down: async (grpcSdk: ConduitGrpcSdk) => {},
};

export const migrationFilesArray: Array<Migration> = [ConfigMigration];
