import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

module.exports = {
  up: async function (grpcSdk: ConduitGrpcSdk) {
    const database = grpcSdk.database!;
    const schema = await database.getSchema('Token');
    const sqlTableName = schema.collectionName;
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
          query: `SELECT * FROM "${sqlTableName}" WHERE "userId" IS NOT NULL;`,
        },
      };
      const tokens = await database.rawQuery('Token', query);
      if (tokens.length === 0) return;
      query = {
        sqlQuery: {
          query:
            `ALTER TABLE "${sqlTableName}" DROP COLUMN "userId";` +
            `ALTER TABLE "${sqlTableName}" ADD COLUMN IF NOT EXISTS "user" uuid;`,
        },
      };
      await database.rawQuery('Token', query);
      for (const token of tokens) {
        query = {
          sqlQuery: {
            query: `UPDATE "${sqlTableName}" SET "user" = '${token.userId}' WHERE _id = '${token._id}';`,
          },
        };
        await database.rawQuery('Token', query);
      }
    }
  },
  down: async function (grpcSdk: ConduitGrpcSdk) {},
};
