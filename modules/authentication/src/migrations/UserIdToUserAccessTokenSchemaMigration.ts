import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

export async function UserIdToUserAccessTokenSchemaMigration(grpcSdk: ConduitGrpcSdk) {
  const exists = await grpcSdk.databaseProvider!.columnExistence('AccessToken', [
    'userId',
  ]);
  if (!exists) {
    return;
  }
  const accessTokenSchemas: any[] = await grpcSdk.databaseProvider!.findMany(
    'AccessToken',
    {},
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
