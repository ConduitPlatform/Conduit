import ConduitGrpcSdk, { RawQuery } from '@conduitplatform/grpc-sdk';

module.exports = {
  up: async function (grpcSdk: ConduitGrpcSdk) {
    const database = grpcSdk.database!;
    const schema = await database.getSchema('Config');
    const sqlTableName = schema.collectionName;
    let query: RawQuery = {
      mongoQuery: {
        find: {},
      },
      sqlQuery: {
        query: `SELECT * FROM ${sqlTableName}`,
      },
    };
    const configs = await database!.rawQuery('Config', query);
    if (configs.length === 0 || configs.length > 1) return;
    const id = configs[0]._id;
    // delete old table
    query = {
      mongoQuery: {
        deleteOne: { _id: id },
      },
      sqlQuery: {
        query:
          `DROP TABLE ${sqlTableName};` +
          `CREATE TABLE IF NOT EXISTS public.${sqlTableName} (` +
          'name character varying(255) COLLATE pg_catalog."default", ' +
          "config json DEFAULT '{}'::json, " +
          '_id uuid NOT NULL, ' +
          '"createdAt" timestamp with time zone NOT NULL, ' +
          '"updatedAt" timestamp with time zone NOT NULL, ' +
          'CONSTRAINT "cnd_Config_pkey" PRIMARY KEY (_id) );',
      },
    };
    await database.rawQuery('Config', query);
    for (const [moduleName, newConfig] of Object.entries(configs[0].moduleConfigs)) {
      query = {
        mongoQuery: {
          insertOne: { name: moduleName, config: newConfig },
        },
        sqlQuery: {
          query: `INSERT INTO ${sqlTableName} (name, config) VALUES ('${moduleName}', ${newConfig});`,
        },
      };
      await database.rawQuery('Config', query);
    }
  },
  down: async function (grpcSdk: ConduitGrpcSdk) {},
};
