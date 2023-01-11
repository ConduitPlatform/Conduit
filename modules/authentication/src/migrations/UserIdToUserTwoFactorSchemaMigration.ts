import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

module.exports = {
  up: async function (grpcSdk: ConduitGrpcSdk) {
    const database = grpcSdk.database!;
    const schema = await database.getSchema('TwoFactorSecret');
    const sqlTableName = schema.collectionName;
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
          query: `SELECT * FROM "${sqlTableName}" WHERE "userId" IS NOT NULL;`,
        },
      };
      const result = await database.rawQuery('TwoFactorSecret', query);
      if (result.length === 0) return;
      query = {
        sqlQuery: {
          query:
            `ALTER TABLE "${sqlTableName}" DROP COLUMN "userId";` +
            `ALTER TABLE "${sqlTableName}" ADD COLUMN IF NOT EXISTS "user" uuid;`,
        },
      };
      await database.rawQuery('TwoFactorSecret', query);
      for (const r of result) {
        query = {
          sqlQuery: {
            query: `UPDATE "${sqlTableName}" SET "user" = '${r.userId}' WHERE _id = '${r._id}';`,
          },
        };
        await database.rawQuery('TwoFactorSecret', query);
      }
    }
  },
  down: async function (grpcSdk: ConduitGrpcSdk) {},
};
