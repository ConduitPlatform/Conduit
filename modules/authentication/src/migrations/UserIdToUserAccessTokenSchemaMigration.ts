import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

module.exports = {
  up: async function (grpcSdk: ConduitGrpcSdk) {
    const database = grpcSdk.database!;
    const schema = await database.getSchema('AccessToken');
    const sqlTableName = schema.collectionName;
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
          query: `SELECT * FROM information_schema.columns WHERE table_name = '${sqlTableName}' AND column_name = 'userId';`,
        },
      };
      const userIdExists = await database.rawQuery('AccessToken', query);
      if (userIdExists.length === 0) return;

      query = {
        sqlQuery: {
          query: `SELECT * FROM "${sqlTableName}";`,
        },
      };
      const accessTokens = await database.rawQuery('AccessToken', query);
      if (accessTokens.length === 0) return;
      query = {
        sqlQuery: {
          query:
            `ALTER TABLE "${sqlTableName}" DROP COLUMN "userId";` +
            `ALTER TABLE "${sqlTableName}" ADD COLUMN IF NOT EXISTS "user" uuid;`,
        },
      };
      await database.rawQuery('AccessToken', query);
      for (const token of accessTokens) {
        query = {
          sqlQuery: {
            query: `UPDATE "${sqlTableName}" SET "user" = '${token.userId}' WHERE _id = '${token._id}';`,
          },
        };
        await database.rawQuery('AccessToken', query);
      }
    }
  },
  down: async function (grpcSdk: ConduitGrpcSdk) {},
};
