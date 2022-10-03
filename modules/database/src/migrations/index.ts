import { DatabaseAdapter } from '../adapters/DatabaseAdapter';
import { MongooseSchema } from '../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../adapters/sequelize-adapter/SequelizeSchema';
import { migrateCrudOperations } from './crudOperations.migration';
import { migrateSecurityClients } from './securityClients.migration';
import { migrateCustomEndpoints } from './customEndpoints.migration';
import { migrateSystemSchemasCms } from './systemSchemasCms.migration';

export async function runMigrations(
  adapter: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
) {
  await migrateCrudOperations(adapter);
  await migrateSecurityClients(adapter);
  await migrateCustomEndpoints(adapter);
  await migrateSystemSchemasCms(adapter);
}
