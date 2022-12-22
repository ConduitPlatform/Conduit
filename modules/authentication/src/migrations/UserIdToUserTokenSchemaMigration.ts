import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

// export async function UserIdToUserTokenSchemaMigration(grpcSdk: ConduitGrpcSdk) {
//   const tokenSchemas: any[] = await grpcSdk.databaseProvider!.findMany('Token', {
//     userId: { $exists: true },
//   });
//
//   for (const tokenSchema of tokenSchemas) {
//     tokenSchema.user = tokenSchema.userId;
//     await grpcSdk.databaseProvider!.findByIdAndUpdate(
//       'Token',
//       tokenSchema._id,
//       tokenSchema,
//     );
//   }
// }

module.exports = {
  up: async function (grpcSdk: ConduitGrpcSdk) {
    const database = grpcSdk.database!;
    const dbType = await database.getDatabaseType();
    if (dbType.type === 'MongoDB') {
      const query = {
        mongoQuery: {
          updateMany: { userId: { $exists: true } },
          options: { $rename: { userId: 'user' } },
        },
      };
      await database.rawQuery('Token', query);
    } else {
      let query = {
        sqlQuery: {
          query: 'SELECT * FROM "cnd_Token" WHERE "userId" IS NOT NULL',
        },
      };
      const tokens = await database.rawQuery('Token', query);
      if (tokens.length === 0) return;
      query = {
        sqlQuery: {
          query:
            'ALTER TABLE "cnd_Token" DROP COLUMN "userId";' +
            'ALTER TABLE "cnd_Token" ADD COLUMN "user" ;',
        },
      };
      await database.rawQuery('Token', query);
      for (const token of tokens) {
        query = {
          sqlQuery: {
            query: `UPDATE "cnd_Token" SET "user" = '${token.userId}' WHERE _id = ${token._id};`,
          },
        };
        await database.rawQuery('Token', query);
      }
    }
  },
  down: async function (grpcSdk: ConduitGrpcSdk) {
    console.log('Executed down function!');
  },
};
