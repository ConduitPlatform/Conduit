import ConduitGrpcSdk, { RawQuery } from '@conduitplatform/grpc-sdk';

/*
 Removes 'cms' model option from Database's system schemas and deletes any registered CustomEndpoints.
 Shouldn't require a controller refresh via bus as this runs before Router is available.
 */

// export async function migrateSystemSchemasCms(
//   adapter: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
// ) {
//   const declaredSchemas = adapter.getSchemaModel('_DeclaredSchema').model;
//   const affectedSchemas: IDeclaredSchema[] = await declaredSchemas.findMany({
//     $and: [
//       { name: { $in: adapter.systemSchemas } },
//       { 'modelOptions.conduit.cms': { $exists: true } },
//     ],
//   });
//
//   if (affectedSchemas.length > 0) {
//     for (const schema of affectedSchemas) {
//       const conduit = schema.modelOptions.conduit;
//       delete conduit!.cms;
//       await declaredSchemas.findByIdAndUpdate(schema._id, {
//         modelOptions: {
//           conduit,
//         },
//       });
//     }
//     const customEndpoints = adapter.getSchemaModel('CustomEndpoints').model;
//     const affectedSchemaNames = affectedSchemas.map(s => s.name);
//     await customEndpoints.deleteMany({ selectedSchema: { $in: affectedSchemaNames } });
//   }
// }

module.exports = {
  up: async function (grpcSdk: ConduitGrpcSdk) {
    const database = grpcSdk.database!;
    const schemas = await database.getSystemSchemas();
    const systemSchemas = JSON.parse(schemas.schemas);
    const query = {
      mongoQuery: {
        find: { 'modelOptions.conduit.cms': { $exists: true } },
      },
      sqlQuery: {
        query:
          'SELECT * FROM "cnd_DeclaredSchema" WHERE "modelOptions.conduit.cms" IS NOT NULL',
      },
    };
    let affectedSchemas = await database.rawQuery('_DeclaredSchemas', query);
    affectedSchemas = affectedSchemas.filter((schema: any) =>
      systemSchemas.includes(schema.name),
    );
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
      await database.rawQuery('_DeclaredSchemas', query);
      const affectedSchemaNames = affectedSchemas.map((s: any) => s.name);
      // SQL requires List instead of Array
      const schemaList = affectedSchemaNames
        .toString()
        .replace('[', '(')
        .replace(']', ')');
      query = {
        mongoQuery: {
          deleteMany: { selectedSchema: { $in: affectedSchemaNames } },
        },
        sqlQuery: {
          query: `DROP FROM "cnd_CustomEndpoints" WHERE "selectedSchema" IN ${schemaList}`,
        },
      };
      await database.rawQuery('_CustomEndpoints', query);
    }
  },
  down: async function (grpcSdk: ConduitGrpcSdk) {
    console.log('Executed down function!');
  },
};
