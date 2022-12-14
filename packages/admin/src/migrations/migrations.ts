import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { Migration } from '@conduitplatform/grpc-sdk/dist/interfaces/Migration';

const isSuperAdminToAdmin = {
  schemaName: 'Admin',
  from: '0.15.0',
  to: '0.16.0',
  up: async (grpcSdk: ConduitGrpcSdk) => {
    const query = {
      mongoQuery: {
        updateOne: {},
        options: {
          $set: { isSuperAdmin: true },
        },
      },
      sqlQuery: {
        query:
          'ALTER TABLE IF EXISTS "cnd_Admin" ADD COLUMN "isSuperAdmin";' +
          'UPDATE TABLE IF EXISTS "cnd_Admin" SET "isSuperAdmin"=true;',
      },
    };
    await grpcSdk.database!.rawQuery('Admin', query);
  },
  down: async (grpcSdk: ConduitGrpcSdk) => {},
};

export const migrationFilesArray: Array<Migration> = [isSuperAdminToAdmin];
