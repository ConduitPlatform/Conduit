import { Schema as SchemaDto } from '../protoTypes/database';
import { ConduitDatabaseSchema } from '../interfaces';

// @dirty-type-cast - Input is never technically ConduitDatabaseSchema yet

export function convertToGrpcSchema(schema: ConduitDatabaseSchema): SchemaDto {
  return {
    name: schema.name,
    fields: JSON.stringify(schema.compiledFields),
    modelOptions: JSON.stringify(schema.modelOptions),
    collectionName: schema.collectionName,
  };
}
