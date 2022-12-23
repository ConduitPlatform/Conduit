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
import { EventEmitter } from 'events';

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
        // store new module version in db
        const state = await this.grpcSdk.config.getDeploymentState();
        const version = state.modules.filter(v => v.moduleName === moduleName)[0];
        await this.database.getSchemaModel('Versions').model.create({
          moduleName: moduleName,
          version: version,
        });
      } catch {
        await model.findByIdAndUpdate(m._id, { status: MigrationStatus.FAILED });
        throw new GrpcError(status.INTERNAL, 'Migration failed');
      }
    }
    const emitter = new EventEmitter();
    emitter.emit(`${moduleName}-initialize`);
    return 'Migrations successfully executed';
  }

  async getCompletedMigrations(
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
      // update module version to unknown
      const version = await this.database
        .getSchemaModel('Versions')
        .model.findOne({ moduleName: moduleName });
      await this.database
        .getSchemaModel('Versions')
        .model.findByIdAndUpdate(version._id, { version: 'unknown' });
    } catch {
      await model.findByIdAndUpdate(migration._id, { status: MigrationStatus.FAILED });
      throw new GrpcError(status.INTERNAL, 'Migration failed');
    }
    return 'Migration successfully executed';
  }
}
