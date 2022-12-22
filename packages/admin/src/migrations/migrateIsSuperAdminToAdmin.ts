import ConduitGrpcSdk, { RawQuery } from '@conduitplatform/grpc-sdk';

module.exports = {
  up: async function (grpcSdk: ConduitGrpcSdk) {
    const database = grpcSdk.database!;
    let query: RawQuery = {
      mongoQuery: {
        find: {},
      },
      sqlQuery: {
        query: 'SELECT * FROM "cnd_Admin"',
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
          'ALTER TABLE "cnd_Admin" ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT FALSE;' +
          `UPDATE "cnd_Admin" SET "isSuperAdmin" = TRUE WHERE _id = '${originalAdmin[0]._id}'`,
      },
    };
    await database.rawQuery('Admin', query);
  },
  down: async function (grpcSdk: ConduitGrpcSdk) {
    console.log('Executed down function!');
  },
};
