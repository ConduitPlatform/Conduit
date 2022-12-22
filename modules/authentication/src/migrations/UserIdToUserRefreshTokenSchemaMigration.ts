import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

// export async function UserIdToUserRefreshTokenSchemaMigration(grpcSdk: ConduitGrpcSdk) {
//   const refreshTokenSchemas: any[] = await grpcSdk.databaseProvider!.findMany(
//     'RefreshToken',
//     { userId: { $exists: true } },
//   );
//
//   for (const refreshTokenSchema of refreshTokenSchemas) {
//     refreshTokenSchema.user = refreshTokenSchema.userId;
//     await grpcSdk.databaseProvider!.findByIdAndUpdate(
//       'RefreshToken',
//       refreshTokenSchema._id,
//       refreshTokenSchema,
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
      await database.rawQuery('RefreshToken', query);
    } else {
      let query = {
        sqlQuery: {
          query: 'SELECT * FROM "cnd_RefreshToken" WHERE "userId" IS NOT NULL',
        },
      };
      const refreshTokens = await database.rawQuery('RefreshToken', query);
      if (refreshTokens.length === 0) return;
      query = {
        sqlQuery: {
          query:
            'ALTER TABLE "cnd_RefreshToken" DROP COLUMN "userId";' +
            'ALTER TABLE "cnd_RefreshToken" ADD COLUMN "user" ;',
        },
      };
      await database.rawQuery('RefreshToken', query);
      for (const token of refreshTokens) {
        query = {
          sqlQuery: {
            query: `UPDATE "cnd_RefreshToken" SET "user" = '${token.userId}' WHERE _id = ${token._id};`,
          },
        };
        await database.rawQuery('RefreshToken', query);
      }
    }
  },
  down: async function (grpcSdk: ConduitGrpcSdk) {
    console.log('Executed down function!');
  },
};
