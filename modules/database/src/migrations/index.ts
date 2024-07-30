import { DatabaseAdapter } from '../adapters/DatabaseAdapter.js';
import { MongooseSchema } from '../adapters/mongoose-adapter/MongooseSchema.js';
import { SequelizeSchema } from '../adapters/sequelize-adapter/SequelizeSchema.js';
import { migrateCrudOperations } from './crudOperations.migration.js';
import { migrateSecurityClients } from './securityClients.migration.js';
import { migrateCustomEndpoints } from './customEndpoints.migration.js';
import { migrateSystemSchemasCms } from './systemSchemasCms.migration.js';

export async function runMigrations(
  adapter: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
) {
  await migrateCrudOperations(adapter);
  await migrateSecurityClients(adapter);
  await migrateCustomEndpoints(adapter);
  await migrateSystemSchemasCms(adapter);
}
