import { DatabaseAdapter } from '../adapters/DatabaseAdapter';
import { MongooseSchema } from '../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../adapters/sequelize-adapter/SequelizeSchema';
import { ICustomEndpoint } from '../interfaces';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

/*
 Populates CustomEndpoints missing selectedSchema id fields.
 Caused by a CMS bug allowing for unpopulated selectedSchema ids while creating a CustomEndpoint using a schema name.
 */

export async function migrateCustomEndpoints(
  adapter: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
) {
  const model = adapter.getSchemaModel('CustomEndpoints').model;
  const customEndpoints: ICustomEndpoint[] = await model.findMany({
    $or: [{ selectedSchema: { $exists: false } }, { selectedSchema: null }],
  });
  for (const endpoint of customEndpoints) {
    const schemaModel = adapter.getSchemaModel('_DeclaredSchema').model;
    const selectedSchema = await schemaModel.findOne({
      name: endpoint.selectedSchemaName,
    });
    if (!selectedSchema) {
      ConduitGrpcSdk.Logger.warn(
        `Failed to fix incomplete CustomEndpoint '${endpoint.name}` +
          ` missing selectedSchema field, with unknown schema name '${endpoint.selectedSchemaName}'`,
      );
      continue;
    }
    await model.findByIdAndUpdate(endpoint._id, {
      selectedSchema: selectedSchema._id.toString(),
    });
  }
}
