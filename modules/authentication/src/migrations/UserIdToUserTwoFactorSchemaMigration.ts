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
      await database.rawQuery('TwoFactorSecret', query);
    } else {
      let query = {
        sqlQuery: {
          query: 'SELECT * FROM "cnd_TwoFactorSecret" WHERE "userId" IS NOT NULL',
        },
      };
      const result = await database.rawQuery('TwoFactorSecret', query);
      if (result.length === 0) return;
      query = {
        sqlQuery: {
          query:
            'ALTER TABLE "cnd_TwoFactorSecret" DROP COLUMN "userId";' +
            'ALTER TABLE "cnd_TwoFactorSecret" ADD COLUMN "user" ;',
        },
      };
      await database.rawQuery('TwoFactorSecret', query);
      for (const r of result) {
        query = {
          sqlQuery: {
            query: `UPDATE "cnd_TwoFactorSecret" SET "user" = '${r.userId}' WHERE _id = ${r._id};`,
          },
        };
        await database.rawQuery('TwoFactorSecret', query);
      }
    }
  },
  down: async function (grpcSdk: ConduitGrpcSdk) {
    console.log('Executed down function!');
  },
};
