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
        query: `SELECT * FROM "${sqlTableName}"`,
      },
    };
    const configs = await database!.rawQuery('Config', query);
    if (configs.length === 0 || configs.length > 1) return;
    query = {
      mongoQuery: {
        deleteOne: {},
      },
      sqlQuery: {
        query:
          `DROP TABLE "${sqlTableName}";` +
          `CREATE TABLE IF NOT EXISTS public."${sqlTableName}" (` +
          'name character varying(255)' +
          "config json DEFAULT '{}'::json, " +
          '_id uuid NOT NULL, ' +
          '"createdAt" timestamp with time zone NOT NULL, ' +
          '"updatedAt" timestamp with time zone NOT NULL, ' +
          `CONSTRAINT "${sqlTableName}_pkey" PRIMARY KEY (_id) );`,
      },
    };
    await database.rawQuery('Config', query);
    for (const [moduleName, newConfig] of Object.entries(configs[0].moduleConfigs)) {
      const date = new Date();
      query = {
        mongoQuery: {
          insertOne: {
            name: moduleName,
            config: newConfig,
            createdAt: date,
            updatedAt: date,
          },
        },
        sqlQuery: {
          query: `INSERT INTO ${sqlTableName} (name, config, createdAt, updatedAt) VALUES ('${moduleName}', ${newConfig}, DEFAULT, DEFAULT);`,
        },
      };
      await database.rawQuery('Config', query);
    }
  },
  down: async function (grpcSdk: ConduitGrpcSdk) {},
};
