import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

export async function UserIdToUserTokenSchemaMigration(grpcSdk: ConduitGrpcSdk) {
  const tokenSchemas: any[] = await grpcSdk.databaseProvider!.findMany('Token', {
    userId: { $exists: true },
  });

  for (const tokenSchema of tokenSchemas) {
    tokenSchema.user = tokenSchema.userId;
    await grpcSdk.databaseProvider!.findByIdAndUpdate(
      'Token',
      tokenSchema._id,
      tokenSchema,
    );
  }
}
