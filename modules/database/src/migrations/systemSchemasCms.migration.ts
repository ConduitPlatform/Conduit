import ConduitGrpcSdk, { RawQuery } from '@conduitplatform/grpc-sdk';

/*
 Removes 'cms' model option from Database's system schemas and deletes any registered CustomEndpoints.
 Shouldn't require a controller refresh via bus as this runs before Router is available.
 */

module.exports = {
  up: async function (grpcSdk: ConduitGrpcSdk) {
    const database = grpcSdk.database!;
    const schemas = await database.getSystemSchemas();
    const systemSchemasArray = schemas.schemas.split(',');
    // SQL requires List instead of Array
    const systemSchemasList = '(' + schemas.schemas + ')';
    const query = {
      mongoQuery: {
        find: {
          $and: [
            { name: { $in: systemSchemasArray } },
            { 'modelOptions.conduit.cms': { $exists: true } },
          ],
        },
      },
      sqlQuery: {
        query: `SELECT * FROM "cnd_DeclaredSchema" WHERE "modelOptions.conduit.cms" IS NOT NULL AND "name" IN ${systemSchemasList}`,
      },
    };
    const affectedSchemas = await database.rawQuery('_DeclaredSchema', query);
    for (const schema of affectedSchemas) {
      const conduit = schema.modelOptions.conduit;
      delete conduit!.cms;
      let query: RawQuery = {
        mongoQuery: {
          updateOne: { _id: schema._id },
          options: { modelOptions: { conduit } },
        },
        sqlQuery: {
          query: `UPDATE "cnd_DeclaredSchema" SET "modelOptions.conduit" = ${conduit} WHERE _id = ${schema._id}`,
        },
      };
      await database.rawQuery('_DeclaredSchema', query);
      const affectedSchemaNames = affectedSchemas.map((s: any) => s.name);
      // SQL requires List instead of Array
      const schemaList = '(' + affectedSchemaNames.join(',') + ')';
      query = {
        mongoQuery: {
          deleteMany: { selectedSchema: { $in: affectedSchemaNames } },
        },
        sqlQuery: {
          query: `DROP FROM "cnd_CustomEndpoints" WHERE "selectedSchema" IN ${schemaList}`,
        },
      };
      await database.rawQuery('CustomEndpoints', query);
    }
  },
  down: async function (grpcSdk: ConduitGrpcSdk) {
    console.log('Executed down function!');
  },
};
