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
          query: `SELECT * FROM information_schema.columns WHERE table_name = '${sqlTableName}' AND column_name = 'userId';`,
        },
      };
      const userIdExists = await database.rawQuery('TwoFactorSecret', query);
      if (userIdExists.length === 0) return;

      query = {
        sqlQuery: {
          query: `SELECT * FROM "${sqlTableName}";`,
        },
      };
      const result = await database.rawQuery('TwoFactorSecret', query);
      if (result.length === 0) return;
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
