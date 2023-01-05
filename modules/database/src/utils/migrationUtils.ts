import { MigrationStatus } from '../interfaces/MigrationTypes';
import { GrpcError, ManifestManager } from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import { DatabaseAdapter } from '../adapters/DatabaseAdapter';
import { MongooseSchema } from '../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../adapters/sequelize-adapter/SequelizeSchema';

export async function updateMigrationLogs(
  database: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
  migrationId: string,
  message: string,
) {
  const migration = await database
    .getSchemaModel('Migrations')
    .model.findOne({ _id: migrationId });
  if (isNil(migration)) {
    throw new GrpcError(status.NOT_FOUND, 'Migration not found');
  }
  let success = false;
  if (
    [MigrationStatus.SUCCESSFUL_MANUAL_UP, MigrationStatus.SUCCESSFUL_AUTO_UP].includes(
      migration.status,
    )
  ) {
    success = true;
  }
  const log = await database
    .getSchemaModel('MigrationLogs')
    .model.findOne({ migration: migration });
  const date = new Date().toJSON();
  if (isNil(log)) {
    await database.getSchemaModel('MigrationLogs').model.create({
      migration: migration,
      success: success,
      logs: { [date]: message },
    });
  } else {
    const jsonLogs = log.logs;
    jsonLogs[date] = message;
    await database
      .getSchemaModel('MigrationLogs')
      .model.findByIdAndUpdate(log._id, { success: success, logs: jsonLogs });
  }
}

export async function moduleVersionCompatibility(
  currentVersion: string,
  storedVersion: string,
) {
  // Returns true if migrations aren't needed
  let tagCompatibility = true;
  try {
    ManifestManager.getInstance().validateTag('', storedVersion, currentVersion);
  } catch {
    tagCompatibility = false;
  }
  return tagCompatibility;
}
