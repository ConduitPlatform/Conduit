import { Sequelize } from 'sequelize';
import ConduitGrpcSdk, {
  ConduitSchema,
  GrpcError,
  Indexable,
  ModelOptionsIndexes,
  PostgresIndexOptions,
  PostgresIndexType,
  RawSQLQuery,
  sleep,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { SequelizeAuto } from 'sequelize-auto';
import { EventEmitter } from 'events';
import { DatabaseAdapter } from '../DatabaseAdapter';
import { SequelizeSchema } from './SequelizeSchema';
import { checkIfPostgresOptions, tableFetch } from './utils';

const sqlSchemaName = process.env.SQL_SCHEMA ?? 'public';

export abstract class SequelizeAdapter<
  T extends SequelizeSchema,
> extends DatabaseAdapter<T> {
  connectionUri: string;
  sequelize!: Sequelize;
  syncedSchemas: string[] = [];
  scheduledSync: NodeJS.Timeout;
  syncEmitter: NodeJS.EventEmitter = new EventEmitter();
  readonly SUPPORTED_DIALECTS = ['postgres', 'mysql', 'sqlite', 'mariadb', 'mssql'];

  constructor(connectionUri: string) {
    super();
    this.connectionUri = connectionUri;
  }

  protected connect() {
    this.sequelize = new Sequelize(this.connectionUri, { logging: false });
  }

  protected async ensureConnected() {
    let error;
    ConduitGrpcSdk.Logger.log('Connecting to database...');
    for (let i = 0; i < this.maxConnTimeoutMs / 200; i++) {
      try {
        await this.sequelize.authenticate();
        if (!this.SUPPORTED_DIALECTS.includes(this.sequelize.getDialect())) {
          console.error(`Unsupported dialect: ${this.sequelize.getDialect()}`);
          process.exit(1);
        }
        ConduitGrpcSdk.Logger.log('Sequelize connection established successfully');
        return;
      } catch (err: any) {
        error = err;
        if (error.original.code !== 'ECONNREFUSED') break;
        await sleep(200);
      }
    }
    if (error) {
      ConduitGrpcSdk.Logger.error('Unable to connect to the database: ', error);
      throw new Error();
    }
  }

  protected abstract hasLegacyCollections(): Promise<boolean>;

  async retrieveForeignSchemas(): Promise<void> {
    const declaredSchemas = await this.getSchemaModel('_DeclaredSchema').model.findMany(
      {},
    );
    const tableNames: string[] = await tableFetch(this.sequelize, sqlSchemaName);
    const declaredSchemaTableName =
      this.models['_DeclaredSchema'].originalSchema.collectionName;
    for (const table of tableNames) {
      if (table === declaredSchemaTableName) continue;
      const tableInDeclaredSchemas = declaredSchemas.some(
        (declaredSchema: ConduitSchema) => {
          if (declaredSchema.collectionName && declaredSchema.collectionName !== '') {
            return declaredSchema.collectionName === table;
          } else {
            return declaredSchema.name === table;
          }
        },
      );
      if (!tableInDeclaredSchemas) {
        this.foreignSchemaCollections.add(table);
      }
    }
  }

  async introspectDatabase(): Promise<ConduitSchema[]> {
    const options = {
      directory: '',
      additional: {
        timestamps: true,
      },
      singularize: true,
      useDefine: true,
      closeConnectionAutomatically: false,
      schema: sqlSchemaName,
    };
    const introspectedSchemas: ConduitSchema[] = [];
    const declaredSchemas = await this.getSchemaModel('_DeclaredSchema').model.findMany(
      {},
    );
    // Wipe Pending Schemas
    await this.getSchemaModel('_PendingSchemas').model.deleteMany({});
    // Update Collection Names and Find Introspectable Schemas
    const importedSchemas: string[] = [];
    declaredSchemas.forEach((schema: ConduitSchema) => {
      if (schema.modelOptions.conduit!.imported) {
        importedSchemas.push(schema.collectionName);
      }
    });
    const introspectableSchemas = Array.from(this.foreignSchemaCollections).concat(
      importedSchemas,
    );
    // Process Schemas
    const auto = new SequelizeAuto(this.sequelize, '', '', {
      ...options,
      tables: introspectableSchemas,
    });
    const data = await auto.run();
    const tables = Object.fromEntries(
      Object.entries(data.tables).filter(([key]) =>
        introspectableSchemas.includes(key.replace(`${sqlSchemaName}.`, '')),
      ),
    );
    for (const tableName of Object.keys(tables)) {
      const table = tables[tableName];
      const originalName = tableName.split('.')[1];
      const schema = await this.introspectSchema(table, originalName);
      introspectedSchemas.push(schema);
      ConduitGrpcSdk.Logger.log(`Introspected schema ${originalName}`);
    }
    return introspectedSchemas;
  }

  abstract introspectSchema(
    table: Indexable,
    originalName: string,
  ): Promise<ConduitSchema>;

  getCollectionName(schema: ConduitSchema) {
    return schema.collectionName && schema.collectionName !== ''
      ? schema.collectionName
      : schema.name;
  }

  protected abstract _createSchemaFromAdapter(
    schema: ConduitSchema,
    options?: { parentSchema: string },
  ): Promise<T>;

  scheduleSync() {
    if (this.scheduledSync) {
      clearInterval(this.scheduledSync);
    }
    const self = this;
    this.scheduledSync = setTimeout(async () => {
      await self.sequelize.sync({ alter: true });
      self.syncEmitter.emit('sync');
    }, 1000);
  }

  waitForSync() {
    const self = this;
    //return promise that resolves once syncEmitter emits sync
    return new Promise<void>((resolve, reject) => {
      self.syncEmitter.once('sync', () => {
        resolve();
      });
    });
  }

  async deleteSchema(
    schemaName: string,
    deleteData: boolean,
    callerModule: string = 'database',
    instanceSync = false,
  ): Promise<string> {
    if (!this.models?.[schemaName])
      throw new GrpcError(status.NOT_FOUND, 'Requested schema not found');
    if (instanceSync) {
      delete this.models[schemaName];
      delete this.sequelize.models[schemaName];
      return 'Instance synchronized!';
    }
    if (this.models[schemaName].originalSchema.ownerModule !== callerModule) {
      throw new GrpcError(status.PERMISSION_DENIED, 'Not authorized to delete schema');
    }
    if (deleteData) {
      await this.models[schemaName].model.drop();
    }
    const model = await this.models['_DeclaredSchema'].findOne(
      JSON.stringify({ name: schemaName }),
    );
    if (model) {
      await this.models['_DeclaredSchema']
        .deleteOne(JSON.stringify({ name: schemaName }))
        .catch((e: Error) => {
          throw new GrpcError(status.INTERNAL, e.message);
        });
      ConduitGrpcSdk.Metrics?.decrement('registered_schemas_total', 1, {
        imported: String(!!model.modelOptions.conduit?.imported),
      });
    }
    delete this.models[schemaName];
    delete this.sequelize.models[schemaName];
    this.registeredSchemas.delete(schemaName);
    this.grpcSdk.bus!.publish('database:delete:schema', schemaName);
    return 'Schema deleted!';
  }

  getSchemaModel(schemaName: string): { model: T } {
    if (this.models && this.models[schemaName]) {
      return { model: this.models[schemaName] };
    }
    throw new GrpcError(status.NOT_FOUND, `Schema ${schemaName} not defined yet`);
  }

  // change to dialect
  getDatabaseType(): string {
    return 'PostgreSQL';
  }

  async createIndexes(
    schemaName: string,
    indexes: ModelOptionsIndexes[],
    callerModule: string,
  ): Promise<string> {
    if (!this.models[schemaName])
      throw new GrpcError(status.NOT_FOUND, 'Requested schema not found');
    indexes = this.checkAndConvertIndexes(schemaName, indexes, callerModule);
    const queryInterface = this.sequelize.getQueryInterface();
    for (const index of indexes) {
      await queryInterface
        .addIndex('cnd_' + schemaName, index.fields, index.options)
        .catch(() => {
          throw new GrpcError(status.INTERNAL, 'Unsuccessful index creation');
        });
    }
    await this.models[schemaName].sync();
    return 'Indexes created!';
  }

  async getIndexes(schemaName: string): Promise<ModelOptionsIndexes[]> {
    if (!this.models[schemaName])
      throw new GrpcError(status.NOT_FOUND, 'Requested schema not found');
    const queryInterface = this.sequelize.getQueryInterface();
    const result = (await queryInterface.showIndex('cnd_' + schemaName)) as Array<any>;
    result.filter(index => {
      const fieldNames = [];
      for (const field of index.fields) {
        fieldNames.push(field.attribute);
      }
      index.fields = fieldNames;
      // extract index type from index definition
      let tmp = index.definition.split('USING ');
      tmp = tmp[1].split(' ');
      index.types = tmp[0];
      delete index.definition;
      index.options = {};
      for (const indexEntry of Object.entries(index)) {
        if (
          indexEntry[0] === 'options' ||
          indexEntry[0] === 'types' ||
          indexEntry[0] === 'fields'
        ) {
          continue;
        }
        if (indexEntry[0] === 'indkey') {
          delete index.indkey;
          continue;
        }
        index.options[indexEntry[0]] = indexEntry[1];
        delete index[indexEntry[0]];
      }
    });
    return result;
  }

  async deleteIndexes(schemaName: string, indexNames: string[]): Promise<string> {
    if (!this.models[schemaName])
      throw new GrpcError(status.NOT_FOUND, 'Requested schema not found');
    const queryInterface = this.sequelize.getQueryInterface();
    for (const name of indexNames) {
      queryInterface.removeIndex('cnd_' + schemaName, name).catch(() => {
        throw new GrpcError(status.INTERNAL, 'Unsuccessful index deletion');
      });
    }
    return 'Indexes deleted';
  }

  async execRawQuery(schemaName: string, rawQuery: RawSQLQuery): Promise<any> {
    return await this.sequelize
      .query(rawQuery.query, rawQuery.options)
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
  }

  protected checkAndConvertIndexes(
    schemaName: string,
    indexes: ModelOptionsIndexes[],
    callerModule: string,
  ) {
    for (const index of indexes) {
      if (!index.types && !index.options) continue;
      if (index.types) {
        if (
          Array.isArray(index.types) ||
          !Object.values(PostgresIndexType).includes(index.types)
        ) {
          throw new GrpcError(
            status.INVALID_ARGUMENT,
            'Invalid index type for PostgreSQL',
          );
        }
        (index.options as PostgresIndexOptions).using = index.types;
        delete index.types;
      }
      if (index.options) {
        if (!checkIfPostgresOptions(index.options)) {
          throw new GrpcError(
            status.INVALID_ARGUMENT,
            'Invalid index options for PostgreSQL',
          );
        }
        if (
          Object.keys(index.options).includes('unique') &&
          this.models[schemaName].originalSchema.ownerModule !== callerModule
        ) {
          throw new GrpcError(
            status.PERMISSION_DENIED,
            'Not authorized to create unique index',
          );
        }
      }
    }
    return indexes;
  }
}
