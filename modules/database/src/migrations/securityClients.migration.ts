import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

module.exports = {
  up: async function (grpcSdk: ConduitGrpcSdk) {
    const database = grpcSdk.database!;
    const schema = await database.getSchema('_DeclaredSchema');
    const sqlTableName = schema.collectionName;
    const query = {
      mongoQuery: {
        updateMany: {
          name: 'Client',
        },
        options: {
          $set: { ownerModule: 'router' },
        },
      },
      sqlQuery: {
        query: `UPDATE ${sqlTableName} SET "ownerModule" = 'router' WHERE name = 'Client'`,
      },
    };
    await database.rawQuery('_DeclaredSchema', query);
  },
  down: async function (grpcSdk: ConduitGrpcSdk) {},
};
