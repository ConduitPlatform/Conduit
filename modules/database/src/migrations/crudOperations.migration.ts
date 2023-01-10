import ConduitGrpcSdk, { ConduitSchema } from '@conduitplatform/grpc-sdk';

module.exports = {
  up: async function (grpcSdk: ConduitGrpcSdk) {
    const database = grpcSdk.database!;
    const schema = await database.getSchema('_DeclaredSchema');
    const sqlTableName = schema.collectionName;
    const query = {
      mongoQuery: {
        find: {},
      },
      sqlQuery: {
        query: `SELECT * FROM ${sqlTableName}`,
      },
    };
    const declaredSchemas = await database.rawQuery('_DeclaredSchema', query);
    const cmsSchemas = declaredSchemas.filter(
      (schema: ConduitSchema) => typeof schema.modelOptions.conduit?.cms === 'boolean',
    );
    for (const schema of cmsSchemas) {
      const { crudOperations, authentication, enabled } = schema.modelOptions.conduit.cms;
      const cms = {
        enabled: enabled,
        crudOperations: {
          create: {
            enabled: crudOperations,
            authenticated: authentication,
          },
          read: {
            enabled: crudOperations,
            authenticated: authentication,
          },
          update: {
            enabled: crudOperations,
            authenticated: authentication,
          },
          delete: {
            enabled: crudOperations,
            authenticated: authentication,
          },
        },
      };
      const modelOptions = { conduit: { cms } };
      const query = {
        mongoQuery: {
          updateOne: { _id: schema._id.toString() },
          options: {
            $set: { modelOptions: modelOptions },
          },
        },
        sqlQuery: {
          query: `UPDATE ${sqlTableName} SET "modelOptions" = ${modelOptions} WHERE _id = '${schema._id}'`,
        },
      };
      await database.rawQuery('_DeclaredSchema', query);
    }
  },
  down: async function (grpcSdk: ConduitGrpcSdk) {},
};
