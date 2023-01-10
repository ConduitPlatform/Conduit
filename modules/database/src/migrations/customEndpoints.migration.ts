import ConduitGrpcSdk, { RawQuery } from '@conduitplatform/grpc-sdk';

/*
 Populates CustomEndpoints missing selectedSchema id fields.
 Caused by a CMS bug allowing for unpopulated selectedSchema ids while creating a CustomEndpoint using a schema name.
 */

module.exports = {
  up: async function (grpcSdk: ConduitGrpcSdk) {
    const database = grpcSdk.database!;
    const customEndpointsSchema = await database.getSchema('CustomEndpoints');
    const declaredSchema = await database.getSchema('_DeclaredSchema');
    const customEndpointsName = customEndpointsSchema.collectionName;
    const declaredSchemaName = declaredSchema.collectionName;
    const query = {
      mongoQuery: {
        find: {
          $or: [{ selectedSchema: { $exists: false } }, { selectedSchema: null }],
        },
      },
      sqlQuery: {
        query: `SELECT * FROM ${customEndpointsName} WHERE "selectedSchema" IS NULL`,
      },
    };
    const customEndpoints = await database.rawQuery('CustomEndpoints', query);
    for (const endpoint of customEndpoints) {
      let query: RawQuery = {
        mongoQuery: {
          find: { name: endpoint.selectedSchemaName },
        },
        sqlQuery: {
          query: `SELECT * FROM ${declaredSchemaName} WHERE name = '${endpoint.selectedSchemaName}'`,
        },
      };
      const selectedSchema = await database.rawQuery('_DeclaredSchema', query);
      if (selectedSchema.length === 0) {
        console.warn(
          `Failed to fix incomplete CustomEndpoint '${endpoint.name}` +
            ` missing selectedSchema field, with unknown schema name '${endpoint.selectedSchemaName}'`,
        );
        continue;
      }
      query = {
        mongoQuery: {
          updateOne: { _id: endpoint._id },
          options: { $set: { selectedSchema: selectedSchema._id.toString() } },
        },
        sqlQuery: {
          query: `UPDATE ${declaredSchemaName} SET "selectedSchema" = '${selectedSchema._id}' WHERE _id = ${endpoint._id}`,
        },
      };
      await database.rawQuery('_DeclaredSchema', query);
    }
  },
  down: async function (grpcSdk: ConduitGrpcSdk) {},
};
