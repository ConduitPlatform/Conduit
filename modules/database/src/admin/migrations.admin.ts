import ConduitGrpcSdk, {
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { DatabaseAdapter } from '../adapters/DatabaseAdapter';
import { MongooseSchema } from '../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../adapters/sequelize-adapter/SequelizeSchema';
import { MigrationStatus } from '../interfaces/MigrationTypes';
import { NodeVM } from 'vm2';
import { isNil } from 'lodash';
import { updateMigrationLogs, updateMigrationState } from '../utils/migrationUtils';

export class MigrationsAdmin {
  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly database: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
  ) {}

  async triggerMigrations(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { moduleName } = call.request.params;
    const model = this.database.getSchemaModel('Migrations').model;
    const migrations = [
      ...(await model.findMany({
        moduleName: moduleName,
        status: MigrationStatus.PENDING,
      })),
    ];
    if (migrations.length === 0) {
      throw new GrpcError(status.NOT_FOUND, `No pending migrations for ${moduleName}`);
    }
    const vm = new NodeVM({ console: 'inherit', sandbox: {} });
    for (const m of migrations) {
      try {
        const migrationInSandbox = vm.run(m.data);
        await migrationInSandbox.up(this.grpcSdk);
        await model.findByIdAndUpdate(m._id, {
          status: MigrationStatus.SUCCESSFUL_MANUAL_UP,
        });
        await updateMigrationLogs(this.database, m._id, m.status);
        await updateMigrationState(this.grpcSdk, moduleName, m.name);
      } catch (e) {
        await model.findByIdAndUpdate(m._id, { status: MigrationStatus.FAILED });
        await updateMigrationLogs(this.database, m._id, e as string);
        throw new GrpcError(status.INTERNAL, 'Migration failed');
      }
    }
    this.grpcSdk.bus?.publish(`${moduleName}:initialize`, '');
    return 'Migrations successfully executed';
  }

  async getSuccessfulMigrations(
    call: ParsedRouterRequest,
  ): Promise<UnparsedRouterResponse> {
    const { moduleName } = call.request.params;
    const model = this.database.getSchemaModel('Migrations').model;
    const migrations = [
      ...(await model.findMany({
        moduleName: moduleName,
        status: MigrationStatus.SUCCESSFUL_MANUAL_UP,
      })),
    ];
    return { migrations: migrations };
  }

  async downgrade(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { moduleName, migrationId } = call.request.params;
    const model = this.database.getSchemaModel('Migrations').model;
    const migration = await model.findOne({
      _id: migrationId,
      moduleName: moduleName,
      status: MigrationStatus.SUCCESSFUL_MANUAL_UP,
    });
    if (isNil(migration)) {
      throw new GrpcError(status.NOT_FOUND, 'Migration not found');
    }
    const vm = new NodeVM({ console: 'inherit', sandbox: {} });
    try {
      const migrationInSandbox = vm.run(migration.data);
      await migrationInSandbox.down(this.grpcSdk);
      await model.findByIdAndUpdate(migration._id, {
        status: MigrationStatus.SUCCESSFUL_MANUAL_DOWN,
      });
      await updateMigrationLogs(this.database, migration._id, migration.status);
      await updateMigrationState(this.grpcSdk, moduleName, migration.name);
    } catch (e) {
      await model.findByIdAndUpdate(migration._id, { status: MigrationStatus.FAILED });
      await updateMigrationLogs(this.database, migration._id, e as string);
      throw new GrpcError(status.INTERNAL, 'Migration failed');
    }
    return 'Migration successfully executed';
  }
}
