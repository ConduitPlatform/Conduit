import { ConduitSchema, ConduitModelOptions, GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { isNil, merge } from 'lodash';
import { DatabaseAdapter } from '../adapters/DatabaseAdapter';
import { MongooseSchema } from '../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../adapters/sequelize-adapter/SequelizeSchema';

export async function migrateSchemaDefinitions(adapter: DatabaseAdapter<MongooseSchema | SequelizeSchema>) {
  const schemas = await adapter.getSchemaModel('_DeclaredSchema').model
    .findMany('{}')
    .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
  if (schemas.filter((schema: any) => schema.name === 'SchemaDefinitions').length === 0)
    return;

  const schemaDefinitions: any = await adapter.getSchemaModel('SchemaDefinitions').model.findMany('{}')
    .catch((e: Error) => {
      throw new GrpcError(status.INTERNAL, e.message);
    });

  // Migrate SchemaDefinitions to DeclaredSchemas
  if (!isNil(schemaDefinitions)) {
    for (const schema of schemaDefinitions) {
      const declaredSchema = await adapter.getSchemaModel('_DeclaredSchema').model
        .findOne(JSON.stringify({ name: schema.name }));
      let modelOptions: ConduitModelOptions = {
        conduit: {
          cms: {
            authentication: schema.authentication,
            crudOperations: schema.crudOperations,
            enabled: schema.enabled,
          }
        }
      };
      try {
        modelOptions = merge(
          JSON.parse(schema.modelOptions),
          modelOptions,
        );
      } catch {}
      if ((declaredSchema) && (
        !declaredSchema.modelOptions ||
        !declaredSchema.modelOptions.conduit ||
        !('cms' in declaredSchema.modelOptions.conduit)
      )) {
        // DeclaredSchema exists, missing metadata
        modelOptions =
          declaredSchema.modelOptions // possibly undefined
          ? merge(declaredSchema.modelOptions, modelOptions)
          : modelOptions;
      }
      const newSchema = new ConduitSchema(schema.name, schema.fields, modelOptions);
      await adapter.createSchemaFromAdapter(newSchema);
    }

    // Delete SchemaDefinitions
    await adapter.deleteSchema('SchemaDefinitions', true, 'database');
  }
}
