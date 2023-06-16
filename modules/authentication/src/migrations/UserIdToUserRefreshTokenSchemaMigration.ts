import ConduitGrpcSdk, { UntypedArray } from '@conduitplatform/grpc-sdk';

export async function UserIdToUserRefreshTokenSchemaMigration(grpcSdk: ConduitGrpcSdk) {
  const exists = await grpcSdk.databaseProvider!.columnExistence('RefreshToken', [
    'userId',
  ]);
  if (!exists) {
    return;
  }
  const refreshTokenSchemas: UntypedArray = await grpcSdk.databaseProvider!.findMany(
    'RefreshToken',
    {},
  );
  for (const refreshTokenSchema of refreshTokenSchemas) {
    refreshTokenSchema.user = refreshTokenSchema.userId;
    delete refreshTokenSchema.userId;
    await grpcSdk.databaseProvider!.findByIdAndReplace(
      'RefreshToken',
      refreshTokenSchema._id,
      refreshTokenSchema,
    );
  }
}
