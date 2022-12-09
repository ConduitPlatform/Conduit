import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { Migration } from '@conduitplatform/grpc-sdk/dist/interfaces/Migration';

const testMigration1 = {
  schemaName: 'TwoFactorSecret',
  from: '14',
  to: '15',
  up: async (grpcSdk: ConduitGrpcSdk) => {
    console.log('Running up function in migration testMigration1!!');
    const twoFactorSecretSchemas: any[] = await grpcSdk.databaseProvider!.findMany(
      'TwoFactorSecret',
      { userId: { $exists: true } },
    );

    for (const twoFactorSecretSchema of twoFactorSecretSchemas) {
      twoFactorSecretSchema.user = twoFactorSecretSchema.userId;
      await grpcSdk.databaseProvider!.findByIdAndUpdate(
        'TwoFactorSecret',
        twoFactorSecretSchema._id,
        twoFactorSecretSchema,
      );
    }
  },
  down: async (grpcSdk: ConduitGrpcSdk) => {},
};

const testMigration2 = {
  schemaName: 'TwoFactorSecret',
  from: '14',
  to: '15',
  up: async (grpcSdk: ConduitGrpcSdk) => {
    console.log('Running up function in migration testMigration1!!');
    const twoFactorSecretSchemas: any[] = await grpcSdk.databaseProvider!.findMany(
      'TwoFactorSecret',
      { userId: { $exists: true } },
    );

    for (const twoFactorSecretSchema of twoFactorSecretSchemas) {
      twoFactorSecretSchema.user = twoFactorSecretSchema.userId;
      await grpcSdk.databaseProvider!.findByIdAndUpdate(
        'TwoFactorSecret',
        twoFactorSecretSchema._id,
        twoFactorSecretSchema,
      );
    }
  },
  down: async (grpcSdk: ConduitGrpcSdk) => {},
};

export const migrationFilesArray: Array<Migration> = [testMigration1, testMigration2];
