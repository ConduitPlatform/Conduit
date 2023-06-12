import ConduitGrpcSdk, { UntypedArray } from '@conduitplatform/grpc-sdk';

export async function UserIdToUserAccessTokenSchemaMigration(grpcSdk: ConduitGrpcSdk) {
  const exists = await grpcSdk.databaseProvider!.columnExistence('AccessToken', [
    'userId',
  ]);
  if (!exists) {
    return;
  }
  const accessTokenSchemas: UntypedArray = await grpcSdk.databaseProvider!.findMany(
    'AccessToken',
    {},
  );
  for (const accessTokenSchema of accessTokenSchemas) {
    accessTokenSchema.user = accessTokenSchema.userId;
    delete accessTokenSchema.userId;
    await grpcSdk.databaseProvider!.findByIdAndReplace(
      'AccessToken',
      accessTokenSchema._id,
      accessTokenSchema,
    );
  }
}
