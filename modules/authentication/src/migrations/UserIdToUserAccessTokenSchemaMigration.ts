import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

export async function UserIdToUserAccessTokenSchemaMigration(grpcSdk: ConduitGrpcSdk) {
  const accessTokenSchemas: any[] = await grpcSdk.databaseProvider!.findMany(
    'AccessToken',
    { userId: { $exists: true } },
  );

  for (const accessTokenSchema of accessTokenSchemas) {
    accessTokenSchema.user = accessTokenSchema.userId;
    await grpcSdk.databaseProvider!.findByIdAndUpdate(
      'AccessToken',
      accessTokenSchema._id,
      accessTokenSchema,
    );
  }
}
