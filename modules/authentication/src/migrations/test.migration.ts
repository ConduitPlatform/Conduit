import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

export const testMigration1 = {
  schemaName: 'TwoFactorSecret',
  from: 14,
  to: 15,
  up: async (grpcSdk: ConduitGrpcSdk) => {
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

export const testMigration2 = {
  schemaName: 'TwoFactorSecret',
  from: 14,
  to: 15,
  up: async (grpcSdk: ConduitGrpcSdk) => {
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
