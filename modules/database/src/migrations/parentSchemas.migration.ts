import { DatabaseAdapter } from '../adapters/DatabaseAdapter';
import { MongooseSchema } from '../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../adapters/sequelize-adapter/SequelizeSchema';

export async function migrateParentSchemas(
  adapter: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
) {
  const model = adapter.getSchemaModel('_DeclaredSchema').model;
  const updatedSchemas = await model.updateMany(
    { parentSchema: '' },
    { parentSchema: null },
  );
  if (updatedSchemas.length > 0) {
    await adapter.recoverSchemasFromDatabase();
  }
}
