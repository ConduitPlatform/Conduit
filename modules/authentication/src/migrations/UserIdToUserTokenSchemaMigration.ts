import ConduitGrpcSdk, { UntypedArray } from '@conduitplatform/grpc-sdk';

export async function UserIdToUserTokenSchemaMigration(grpcSdk: ConduitGrpcSdk) {
  const exists = await grpcSdk.databaseProvider!.columnExistence('Token', ['userId']);
  if (!exists) {
    return;
  }
  const tokenSchemas: UntypedArray = await grpcSdk.databaseProvider!.findMany(
    'Token',
    {},
  );
  for (const tokenSchema of tokenSchemas) {
    tokenSchema.user = tokenSchema.userId;
    delete tokenSchema.userId;
    await grpcSdk.databaseProvider!.findByIdAndReplace(
      'Token',
      tokenSchema._id,
      tokenSchema,
    );
  }
}
