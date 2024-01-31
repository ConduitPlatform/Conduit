import { DatabaseAdapter } from '../adapters/DatabaseAdapter.js';
import { MongooseSchema } from '../adapters/mongoose-adapter/MongooseSchema.js';
import { SequelizeSchema } from '../adapters/sequelize-adapter/SequelizeSchema.js';

export async function migrateSecurityClients(
  adapter: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
) {
  const model = adapter.getSchemaModel('_DeclaredSchema').model;
  await model.updateMany({ name: 'Client' }, { ownerModule: 'router' });
}
