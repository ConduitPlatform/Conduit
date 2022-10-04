import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

export async function UserIdToUserRefreshTokenSchemaMigration(grpcSdk: ConduitGrpcSdk) {
  const refreshTokenSchemas: any[] = await grpcSdk.databaseProvider!.findMany(
    'RefreshToken',
    { userId: { $exists: true } },
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
