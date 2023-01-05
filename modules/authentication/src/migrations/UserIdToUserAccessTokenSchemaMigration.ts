import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

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
      await database.rawQuery('AccessToken', query);
    } else {
      let query = {
        sqlQuery: {
          query: 'SELECT * FROM "cnd_AccessToken" WHERE "userId" IS NOT NULL',
        },
      };
      const accessTokens = await database.rawQuery('AccessToken', query);
      if (accessTokens.length === 0) return;
      query = {
        sqlQuery: {
          query:
            'ALTER TABLE "cnd_AccessToken" DROP COLUMN "userId";' +
            'ALTER TABLE "cnd_AccessToken" ADD COLUMN "user" ;',
        },
      };
      await database.rawQuery('AccessToken', query);
      for (const token of accessTokens) {
        query = {
          sqlQuery: {
            query: `UPDATE "cnd_AccessToken" SET "user" = '${token.userId}' WHERE _id = ${token._id};`,
          },
        };
        await database.rawQuery('AccessToken', query);
      }
    }
  },
  down: async function (grpcSdk: ConduitGrpcSdk) {
    console.log('Executed down function!');
  },
};
