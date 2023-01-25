import { Sequelize } from 'sequelize';
import { SequelizeSchema } from './SequelizeSchema';
import { schemaConverter } from './SchemaConverter';
import ConduitGrpcSdk, {
  ConduitModel,
  ConduitSchema,
  GrpcError,
  Indexable,
  ModelOptionsIndexes,
  PostgresIndexOptions,
  PostgresIndexType,
  RawSQLQuery,
  sleep,
} from '@conduitplatform/grpc-sdk';
import { DatabaseAdapter } from '../DatabaseAdapter';
import { validateSchema } from '../utils/validateSchema';
import { sqlSchemaConverter } from '../../introspection/sequelize/utils';
import { status } from '@grpc/grpc-js';
import { SequelizeAuto } from 'sequelize-auto';
import { isNil } from 'lodash';
import { checkIfPostgresOptions } from './utils';
import { ConduitDatabaseSchema } from '../../interfaces';
import { EventEmitter } from 'events';

const sqlSchemaName = process.env.SQL_SCHEMA ?? 'public';

export class SequelizeAdapter extends DatabaseAdapter<SequelizeSchema> {
  connectionUri: string;
  sequelize!: Sequelize;
  syncedSchemas: string[] = [];
  scheduledSync: NodeJS.Timeout;
  syncEmitter: NodeJS.EventEmitter = new EventEmitter();

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

  protected async hasLegacyCollections() {
    return (
      (
        await this.sequelize.query(
          `SELECT EXISTS (
    SELECT FROM 
        information_schema.tables 
    WHERE 
        table_schema LIKE '${sqlSchemaName}' AND 
        table_type LIKE 'BASE TABLE' AND
        table_name = '_DeclaredSchema'
    );`,
        )
      )[0][0] as { exists: boolean }
    ).exists;
  }

  async retrieveForeignSchemas(): Promise<void> {
    const declaredSchemas = await this.getSchemaModel('_DeclaredSchema').model.findMany(
      {},
    );
    const tableNames: string[] = (
      await this.sequelize.query(
        `select * from pg_tables where schemaname='${sqlSchemaName}';`,
      )
    )[0].map((t: any) => t.tablename);
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

  async introspectSchema(table: Indexable, originalName: string): Promise<ConduitSchema> {
    sqlSchemaConverter(table);

    await this.sequelize.query(
      `ALTER TABLE ${sqlSchemaName}.${originalName} ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP DEFAULT NOW()`,
    );
    await this.sequelize.query(
      `ALTER TABLE ${sqlSchemaName}.${originalName} ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP DEFAULT NOW()`,
    );

    const schema = new ConduitSchema(originalName, table as ConduitModel, {
      timestamps: true,
      conduit: {
        noSync: true,
        permissions: {
          extendable: false,
          canCreate: false,
          canModify: 'Nothing',
          canDelete: false,
        },
        cms: {
          authentication: false,
          crudOperations: {
            create: {
              enabled: false,
              authenticated: false,
            },
            read: {
              enabled: false,
              authenticated: false,
            },
            update: {
              enabled: false,
              authenticated: false,
            },
            delete: {
              enabled: false,
              authenticated: false,
            },
          },
          enabled: true,
        },
      },
    });
    schema.ownerModule = 'database';

    return schema;
  }

  getCollectionName(schema: ConduitSchema) {
    return schema.collectionName && schema.collectionName !== ''
      ? schema.collectionName
      : schema.name;
  }

  private async processExtractedSchemas(
    schema: ConduitSchema,
    extractedSchemas: { [key: string]: any },
    associatedSchemas: { [key: string]: SequelizeSchema | SequelizeSchema[] },
  ) {
    for (const extractedSchema in extractedSchemas) {
      let modelOptions = {
        ...schema.modelOptions,
        permissions: {
          extendable: false,
          canCreate: false,
          canModify: 'Nothing',
          canDelete: false,
        },
      };
      let modeledSchema;
      let isArray = false;
      if (Array.isArray(extractedSchemas[extractedSchema])) {
        isArray = true;
        modeledSchema = new ConduitSchema(
          `${schema.name}_${extractedSchema}`,
          extractedSchemas[extractedSchema][0],
          modelOptions,
          `${schema.collectionName}_${extractedSchema}`,
        );
      } else {
        modeledSchema = new ConduitSchema(
          `${schema.name}_${extractedSchema}`,
          extractedSchemas[extractedSchema],
          modelOptions,
          `${schema.collectionName}_${extractedSchema}`,
        );
      }

      modeledSchema.ownerModule = schema.ownerModule;
      (modeledSchema as ConduitDatabaseSchema).compiledFields = modeledSchema.fields;
      // check index compatibility
      const sequelizeSchema = await this._createSchemaFromAdapter(modeledSchema, {
        parentSchema: schema.name,
      });
      associatedSchemas[extractedSchema] = isArray ? [sequelizeSchema] : sequelizeSchema;
    }
  }

  protected async _createSchemaFromAdapter(
    schema: ConduitSchema,
    options?: { parentSchema: string },
  ): Promise<SequelizeSchema> {
    let compiledSchema = JSON.parse(JSON.stringify(schema));
    (compiledSchema as any).fields = JSON.parse(
      JSON.stringify((schema as ConduitDatabaseSchema).compiledFields),
    );
    if (this.registeredSchemas.has(compiledSchema.name)) {
      if (compiledSchema.name !== 'Config') {
        compiledSchema = validateSchema(
          this.registeredSchemas.get(compiledSchema.name)!,
          compiledSchema,
        );
      }
      delete this.sequelize.models[compiledSchema.collectionName];
    }

    const [newSchema, extractedSchemas, extractedRelations] = schemaConverter(
      compiledSchema,
      this.sequelize.getDialect(),
    );
    this.registeredSchemas.set(
      schema.name,
      Object.freeze(JSON.parse(JSON.stringify(schema))),
    );
    if (Object.keys(extractedRelations).length > 0) {
      let pendingModels: string[] = [];
      for (const relation in extractedRelations) {
        let rel = Array.isArray(extractedRelations[relation])
          ? (extractedRelations[relation] as any[])[0]
          : extractedRelations[relation];
        if (!this.syncedSchemas.includes(rel.model)) {
          if (!pendingModels.includes(rel.model)) {
            pendingModels.push(rel.model);
          }
        }
      }
      while (pendingModels.length > 0) {
        await sleep(500);
        pendingModels = pendingModels.filter(model => {
          return !this.syncedSchemas.includes(model);
        });
      }
    }
    let associatedSchemas: { [key: string]: SequelizeSchema | SequelizeSchema[] } = {};
    await this.processExtractedSchemas(schema, extractedSchemas, associatedSchemas);
    if (options?.parentSchema) {
      schema.parentSchema = options.parentSchema;
    }
    this.models[schema.name] = new SequelizeSchema(
      this.sequelize,
      newSchema,
      schema,
      this,
      associatedSchemas,
      extractedRelations,
    );

    const noSync = this.models[schema.name].originalSchema.modelOptions.conduit!.noSync;
    // do not sync extracted schemas
    if ((isNil(noSync) || !noSync) && !options) {
      // await this.models[schema.name].sync();
      if (!this.syncedSchemas.includes(schema.name)) {
        this.syncedSchemas.push(schema.name);
      }
      this.scheduleSync();
      // await this.sequelize.sync({ alter: true });
    }
    // do not store extracted schemas to db
    if (!options) {
      await this.saveSchemaToDatabase(schema);
    }
    if ((isNil(noSync) || !noSync) && !options) {
      await this.waitForSync();
    }

    return this.models[schema.name];
  }

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
    this.models['_DeclaredSchema']
      .findOne(JSON.stringify({ name: schemaName }))
      .then(model => {
        if (model) {
          this.models['_DeclaredSchema']
            .deleteOne(JSON.stringify({ name: schemaName }))
            .catch((e: Error) => {
              throw new GrpcError(status.INTERNAL, e.message);
            });
          if (!instanceSync) {
            ConduitGrpcSdk.Metrics?.decrement('registered_schemas_total', 1, {
              imported: String(!!model.modelOptions.conduit?.imported),
            });
          }
        }
      });
    delete this.models[schemaName];
    delete this.sequelize.models[schemaName];
    this.registeredSchemas.delete(schemaName);
    this.grpcSdk.bus!.publish('database:delete:schema', schemaName);
    return 'Schema deleted!';
  }

  getSchemaModel(schemaName: string): { model: SequelizeSchema } {
    if (this.models && this.models[schemaName]) {
      const self = this;
      return { model: this.models[schemaName] };
    }
    throw new GrpcError(status.NOT_FOUND, `Schema ${schemaName} not defined yet`);
  }

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

  private checkAndConvertIndexes(
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
