import ConduitGrpcSdk, { ConduitSchema, GrpcError } from '@quintessential-sft/conduit-grpc-sdk';
import { _DeclaredSchema } from '../models';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash';

export async function migrateSchemaDefinitions(grpcSdk: ConduitGrpcSdk) {
  // make sure the schema is initialized properly
  _DeclaredSchema.getInstance(grpcSdk.databaseProvider!);
  const schemaDefinitions: any = await grpcSdk
    .databaseProvider!.findMany('SchemaDefinitions', {})
    .catch((e: Error) => {
      throw new GrpcError(status.INTERNAL, e.message);
    });
  if (!isNil(schemaDefinitions)) {
    // Migrate SchemaDefinitions to DeclaredSchemas
    for (const schema of schemaDefinitions) {
      const declaredSchema = await _DeclaredSchema
        .getInstance()
        .findOne({ name: schema.name });
      if (isNil(declaredSchema)) {
        const modelOptions = {
          ...JSON.parse(schema.modelOptions),
          conduit: {
            cms: {
              authentication: schema.authentication,
              crudOperations: schema.crudOperations,
              enabled: schema.enabled,
            },
          },
        };
        let newSchema = new ConduitSchema(schema.name, schema.fields, modelOptions);
        await grpcSdk.databaseProvider!.createSchemaFromAdapter(newSchema);
      }
    }
    // Delete SchemaDefinitions schema entry in DeclaredSchemas
    await grpcSdk.databaseProvider!.deleteOne('_DeclaredSchema', { name: 'SchemaDefinitions' });
    // Delete SchemaDefinitions collection/table // TODO: Requires handling systemRequired check in adapters
    // await grpcSdk.databaseProvider!.deleteSchema('SchemaDefinitions', true);
  }
}
