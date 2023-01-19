import { readFileSync, readdirSync } from 'fs';
import { DatabaseProvider } from '../modules';

/**
 * Registers all the migrations of a module and then triggers them
 * There could be many migration files or one that contains all migrations
 * @param database
 * @param moduleName
 * @param moduleVersion => version of the module that registers migrations
 * @param path => absolute path to module's migration folder
 **/
export async function registerMigrations(
  database: DatabaseProvider,
  moduleName: string,
  moduleVersion: string,
  path: string,
) {
  const files = readdirSync(path).filter(f => f.endsWith('.js'));
  const migrations = new Map<string, string>();
  for (const name of files) {
    const migrationPath = path + `/${name}`;
    const data = readFileSync(migrationPath, 'utf-8');
    if (!isMigrationFile(data)) {
      continue;
    }
    migrations.set(name.split('.js')[0], data);
  }
  for (const [migrationName, data] of migrations) {
    await database.registerMigration(moduleName, moduleVersion, migrationName, data);
  }
  await database.triggerMigrations(moduleName);
  return;
}

function isMigrationFile(file: string) {
  const upRegex = /up: function/;
  const downRegex = /down: function/;
  return upRegex.test(file) && downRegex.test(file);
}
