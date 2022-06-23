import { DatabaseAdapter } from '../adapters/DatabaseAdapter';
import { MongooseSchema } from '../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../adapters/sequelize-adapter/SequelizeSchema';
import { migrateCrudOperations } from './crudOperations.migration';
import { migrateSecurityClients } from './securityClients.migration';

export async function runMigrations(
  adapter: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
) {
  await migrateCrudOperations(adapter);
  await migrateSecurityClients(adapter);
}
