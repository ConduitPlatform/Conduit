import { readFileSync, readdirSync } from 'fs';
import { DatabaseProvider } from '../modules';

/**
 * Returns a map that holds pairs of (module migration name)-(contents of migration file in string format)
 * There could be many migration files or one that contains all migrations
 * @param database
 * @param moduleName
 * @param moduleVersion => version of the module that registers this migration
 * @param path => absolute path to module's migration folder
 **/
export async function registerMigrations(
  database: DatabaseProvider,
  moduleName: string,
  moduleVersion: string,
  path: string,
) {
  const files = readdirSync(path).filter(f => f.endsWith('.js'));
  if (files.length === 0) {
    throw new Error('Migration files not found');
  }
  const migrations = new Map<string, string>();
  for (const name of files) {
    const migrationPath = path + `/${name}`;
    const data = readFileSync(migrationPath, 'utf-8');
    migrations.set(name.split('.js')[0], data);
  }
  for (const [migrationName, data] of migrations) {
    await database.registerMigration(moduleName, moduleVersion, migrationName, data);
  }
  await database.triggerMigrations(moduleName);
  return;
}
