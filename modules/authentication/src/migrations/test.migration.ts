import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

const testMigration1 = {
  schemaName: 'TwoFactorSecret',
  v1: 14,
  v2: 15,
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
  down: (grpcSdk: ConduitGrpcSdk) => {},
};

const testMigration2 = {
  schemaName: 'TwoFactorSecret',
  v1: 14,
  v2: 15,
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
  down: (grpcSdk: ConduitGrpcSdk) => {},
};

export const migrationFilesArray = [testMigration1];
