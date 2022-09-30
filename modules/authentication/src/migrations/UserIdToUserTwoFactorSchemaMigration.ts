import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

export async function UserIdToUserTwoFactorSchemaMigration(grpcSdk: ConduitGrpcSdk) {
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
}
