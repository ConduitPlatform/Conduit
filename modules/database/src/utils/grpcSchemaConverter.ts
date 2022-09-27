import { Schema as SchemaDto } from '../protoTypes/database';
import { ConduitDatabaseSchema } from '../interfaces';
import { DatabaseAdapter } from '../adapters/DatabaseAdapter';
import { MongooseSchema } from '../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../adapters/sequelize-adapter/SequelizeSchema';

// @dirty-type-cast - Input is never technically ConduitDatabaseSchema yet

export function convertToGrpcSchema(
  adapter: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
  schema: ConduitDatabaseSchema,
): SchemaDto {
  return {
    name: schema.name,
    fields: JSON.stringify(schema.compiledFields),
    modelOptions: JSON.stringify(schema.modelOptions),
    collectionName: schema.collectionName,
    fieldHash: adapter.models[schema.name].fieldHash,
  };
}
