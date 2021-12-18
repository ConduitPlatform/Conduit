import ConduitGrpcSdk, { ConduitSchema, GrpcError } from '@quintessential-sft/conduit-grpc-sdk';
import { _DeclaredSchema } from '../models';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash';

export async function migrateSchemaDefinitions(grpcSdk: ConduitGrpcSdk) {
  const schemas = await grpcSdk.databaseProvider!.getSchemas()
    .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
  if (schemas.filter((schema: any) => schema.name === 'SchemaDefinitions').length === 0)
    return;

  // Initialize DeclaredSchema ConduitActiveSchema
  _DeclaredSchema.getInstance(grpcSdk.databaseProvider!);

  const schemaDefinitions: any = await grpcSdk
    .databaseProvider!.findMany('SchemaDefinitions', {})
    .catch((e: Error) => {
      throw new GrpcError(status.INTERNAL, e.message);
    });

  // Migrate SchemaDefinitions to DeclaredSchemas
  if (!isNil(schemaDefinitions)) {
    for (const schema of schemaDefinitions) {
      const declaredSchema = await _DeclaredSchema
        .getInstance()
        .findOne({ name: schema.name });
      let modelOptions = {
        conduit: {
          cms: {
            authentication: schema.authentication,
            crudOperations: schema.crudOperations,
            enabled: schema.enabled,
          },
        }
      }
      if (isNil(declaredSchema)) {
        // No corresponding DeclaredSchema
        modelOptions = { ...modelOptions, ...JSON.parse(schema.modelOptions) };
      } else if (!('conduit' in declaredSchema.modelOptions)) {
        // DeclaredSchema exists, missing metadata
        modelOptions = { ...modelOptions, ...declaredSchema.modelOptions! };
      }
      const newSchema = new ConduitSchema(schema.name, schema.fields, modelOptions);
      await grpcSdk.databaseProvider!.createSchemaFromAdapter(newSchema);
    }

    // Delete SchemaDefinitions // TODO: Requires handling systemRequired check in adapters
    // await grpcSdk.databaseProvider!.deleteSchema('SchemaDefinitions', true);
  }
}
