import ConduitGrpcSdk, { RawQuery } from '@conduitplatform/grpc-sdk';

module.exports = {
  up: async function (grpcSdk: ConduitGrpcSdk) {
    const database = grpcSdk.database!;
    const schema = await database.getSchema('Admin');
    const sqlTableName = schema.collectionName;
    let query: RawQuery = {
      mongoQuery: {
        find: {},
      },
      sqlQuery: {
        query: `SELECT * FROM "${sqlTableName}"`,
      },
    };
    const originalAdmin = await database.rawQuery('Admin', query);
    if (originalAdmin.length === 0) return;
    query = {
      mongoQuery: {
        updateOne: {},
        options: { $set: { isSuperAdmin: true } },
      },
      sqlQuery: {
        query:
          `ALTER TABLE "${sqlTableName}" ADD COLUMN IF NOT EXISTS "isSuperAdmin" BOOLEAN NOT NULL DEFAULT FALSE;` +
          `UPDATE "${sqlTableName}" SET "isSuperAdmin" = TRUE WHERE _id = '${originalAdmin[0]._id}'`,
      },
    };
    await database.rawQuery('Admin', query);
  },
  down: async function (grpcSdk: ConduitGrpcSdk) {},
};
