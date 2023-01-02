import { MigrationStatus } from '../interfaces/MigrationTypes';
import ConduitGrpcSdk, { GrpcError } from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import { DatabaseAdapter } from '../adapters/DatabaseAdapter';
import { MongooseSchema } from '../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../adapters/sequelize-adapter/SequelizeSchema';

export async function updateMigrationState(
  grpcSdk: ConduitGrpcSdk,
  moduleName: string,
  migrationName: string,
) {
  const state = await grpcSdk.state!.getKey('migrationState');
  const json = JSON.parse(state!);
  if (json.state.hasOwnProperty(moduleName)) {
    json[moduleName].append(migrationName);
  } else {
    json[moduleName] = [migrationName];
  }
  await grpcSdk.state!.setKey('migrationState', JSON.stringify(json));
}

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
    migration.status ===
    (MigrationStatus.SUCCESSFUL_MANUAL_UP ||
      MigrationStatus.SUCCESSFUL_AUTO_UP ||
      MigrationStatus.SKIPPED)
  ) {
    success = true;
  }
  const log = await database
    .getSchemaModel('MigrationLogs')
    .model.findOne({ migration: migrationId });
  const date = new Date().toJSON();
  if (isNil(log)) {
    await database
      .getSchemaModel('MigrationLogs')
      .model.create({
        migration: migrationId,
        success: success,
        logs: { date: message },
      });
  } else {
    const jsonLogs = log.logs;
    jsonLogs[date] = message;
    await database
      .getSchemaModel('MigrationLogs')
      .model.findByIdAndUpdate(log._id, { success: success, logs: jsonLogs });
  }
}
