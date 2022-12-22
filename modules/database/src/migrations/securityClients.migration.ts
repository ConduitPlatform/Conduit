import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

// export async function migrateSecurityClients(
//   adapter: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
// ) {
//   const model = adapter.getSchemaModel('_DeclaredSchema').model;
//   await model.updateMany({ name: 'Client' }, { ownerModule: 'router' }, true);
// }

module.exports = {
  up: async function (grpcSdk: ConduitGrpcSdk) {
    const database = grpcSdk.database!;
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
        query: `UPDATE "cnd_DeclaredSchema" SET "ownerModule" = 'router' WHERE name = 'Client'`,
      },
    };
    await database.rawQuery('_DeclaredSchema', query);
  },
  down: async function (grpcSdk: ConduitGrpcSdk) {
    console.log('Executed down function!');
  },
};
