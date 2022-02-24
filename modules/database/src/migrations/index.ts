import { DatabaseAdapter } from '../adapters/DatabaseAdapter';
import { MongooseSchema } from '../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../adapters/sequelize-adapter/SequelizeSchema';
import { migrateModelOptions } from './modelOptions.migration';
import { migrateSchemaDefinitions } from './schemaDefinitions.migration';
import { migrateCustomEndpoints } from './customEndpoint.migration';
import { cmsOwnersMigration } from './cmsOwners.migration';

export async function runMigrations(adapter: DatabaseAdapter<MongooseSchema | SequelizeSchema>){
  await migrateModelOptions(adapter);
  await migrateSchemaDefinitions(adapter);
  await migrateCustomEndpoints(adapter);
  await cmsOwnersMigration(adapter);
}
