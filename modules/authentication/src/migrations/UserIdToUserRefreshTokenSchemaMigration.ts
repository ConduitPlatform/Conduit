import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

export async function UserIdToUserRefreshTokenSchemaMigration(grpcSdk: ConduitGrpcSdk) {
  const exists = await grpcSdk.databaseProvider!.columnExistence('RefreshToken', [
    'userId',
  ]);
  if (!exists) {
    return;
  }
  const refreshTokenSchemas: any[] = await grpcSdk.databaseProvider!.findMany(
    'RefreshToken',
    {},
  );
  for (const refreshTokenSchema of refreshTokenSchemas) {
    refreshTokenSchema.user = refreshTokenSchema.userId;
    await grpcSdk.databaseProvider!.findByIdAndUpdate(
      'RefreshToken',
      refreshTokenSchema._id,
      refreshTokenSchema,
    );
  }
}
