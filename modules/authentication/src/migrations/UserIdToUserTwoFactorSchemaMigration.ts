import { ConduitGrpcSdk, UntypedArray } from '@conduitplatform/grpc-sdk';

export async function UserIdToUserTwoFactorSchemaMigration(grpcSdk: ConduitGrpcSdk) {
  const exists = await grpcSdk.databaseProvider!.columnExistence('TwoFactorSecret', [
    'userId',
  ]);
  if (!exists) {
    return;
  }
  const twoFactorSecretSchemas: UntypedArray = await grpcSdk.databaseProvider!.findMany(
    'TwoFactorSecret',
    {},
  );
  for (const twoFactorSecretSchema of twoFactorSecretSchemas) {
    twoFactorSecretSchema.user = twoFactorSecretSchema.userId;
    delete twoFactorSecretSchema.userId;
    await grpcSdk.databaseProvider!.findByIdAndReplace(
      'TwoFactorSecret',
      twoFactorSecretSchema._id,
      twoFactorSecretSchema,
    );
  }
}
