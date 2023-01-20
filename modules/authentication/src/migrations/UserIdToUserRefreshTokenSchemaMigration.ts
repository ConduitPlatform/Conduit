import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

module.exports = {
  up: async function (grpcSdk: ConduitGrpcSdk) {
    const database = grpcSdk.database!;
    const schema = await database.getSchema('RefreshToken');
    const sqlTableName = schema.collectionName;
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
          query: `SELECT * FROM information_schema.columns WHERE table_name = '${sqlTableName}' AND column_name = 'userId';`,
        },
      };
      const userIdExists = await database.rawQuery('RefreshToken', query);
      if (userIdExists.length === 0) return;

      query = {
        sqlQuery: {
          query: `SELECT * FROM "${sqlTableName}";`,
        },
      };
      const refreshTokens = await database.rawQuery('RefreshToken', query);
      if (refreshTokens.length === 0) return;
      for (const token of refreshTokens) {
        query = {
          sqlQuery: {
            query: `UPDATE "${sqlTableName}" SET "user" = '${token.userId}' WHERE _id = '${token._id}';`,
          },
        };
        await database.rawQuery('RefreshToken', query);
      }
    }
  },
  down: async function (grpcSdk: ConduitGrpcSdk) {},
};
