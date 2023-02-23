import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

export async function UserIdToUserTokenSchemaMigration(grpcSdk: ConduitGrpcSdk) {
  const exists = await grpcSdk.databaseProvider!.columnExistence('Token', ['userId']);
  if (!exists) {
    return;
  }
  const tokenSchemas: any[] = await grpcSdk.databaseProvider!.findMany('Token', {});
  for (const tokenSchema of tokenSchemas) {
    tokenSchema.user = tokenSchema.userId;
    await grpcSdk.databaseProvider!.findByIdAndUpdate(
      'Token',
      tokenSchema._id,
      tokenSchema,
    );
  }
}
