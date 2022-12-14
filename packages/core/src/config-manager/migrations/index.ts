import ConduitGrpcSdk, { Migration } from '@conduitplatform/grpc-sdk';
import { migrateConfig } from './migrateConfig';

const configMigration = {
  schemaName: 'Config',
  from: '0.14.0',
  to: '0.15.0',
  up: async (grpcSdk: ConduitGrpcSdk) => {
    await migrateConfig();
  },
  down: async (grpcSdk: ConduitGrpcSdk) => {},
};

export const migrationFilesArray: Array<Migration> = [configMigration];
