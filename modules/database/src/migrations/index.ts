import { DatabaseAdapter } from '../adapters/DatabaseAdapter.js';
import { MongooseSchema } from '../adapters/mongoose-adapter/MongooseSchema.js';
import { SequelizeSchema } from '../adapters/sequelize-adapter/SequelizeSchema.js';
import { migrateCommunicationSchemas } from './coms.migration.js';

export async function runMigrations(
  adapter: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
) {
  await migrateCommunicationSchemas(adapter);
}
