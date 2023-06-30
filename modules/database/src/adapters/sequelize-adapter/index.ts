import { Sequelize } from 'sequelize';
import ConduitGrpcSdk, {
  ConduitModel,
  ConduitModelField,
  ConduitSchema,
  GrpcError,
  Indexable,
  ModelOptionsIndex,
  MySQLMariaDBIndexOptions,
  PgIndexOptions,
  RawSQLQuery,
  SequelizeIndexType,
  sleep,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { SequelizeAuto } from 'sequelize-auto';
import { DatabaseAdapter } from '../DatabaseAdapter';
import { SequelizeSchema } from './SequelizeSchema';
import {
  checkIfSequelizeIndexOptions,
  checkIfSequelizeIndexType,
  compileSchema,
  resolveRelatedSchemas,
  tableFetch,
} from './utils';
import { sqlIntroSchemaConverter } from '../../introspection/sequelize/utils';
import {
  ConduitDatabaseSchema,
  introspectedSchemaCmsOptionsDefaults,
} from '../../interfaces';
import { sqlSchemaConverter } from './sql-adapter/SqlSchemaConverter';
import { pgSchemaConverter } from './postgres-adapter/PgSchemaConverter';
import { isNil, merge } from 'lodash';
import { findAndRemoveIndex } from '../utils';

const sqlSchemaName = process.env.SQL_SCHEMA ?? 'public';

export abstract class SequelizeAdapter extends DatabaseAdapter<SequelizeSchema> {
  connectionUri: string;
  sequelize!: Sequelize;
  readonly SUPPORTED_DIALECTS = ['postgres', 'mysql', 'sqlite', 'mariadb'];

  constructor(connectionUri: string) {
    super();
    this.connectionUri = connectionUri;
  }

  async createView(
    modelName: string,
    viewName: string,
    joinedSchemas: string[],
    query: any,
  ): Promise<void> {
    if (!this.models[modelName]) {
      throw new GrpcError(status.NOT_FOUND, `Model ${modelName} not found`);
    }
    const model = this.models[modelName];
    const newSchema = JSON.parse(JSON.stringify(model.schema));
    newSchema.name = viewName;
    newSchema.collectionName = viewName;
    const viewModel = new SequelizeSchema(
      this.grpcSdk,
      this.sequelize,
      newSchema,
      model.originalSchema,
      this,
      model.extractedRelations,
      model.objectPaths,
      true,
    );
    const dialect = this.sequelize.getDialect();
    const queryViewName = dialect === 'postgres' ? `"${viewName}"` : viewName;
    const viewQuery =
      dialect !== 'sqlite'
        ? `CREATE OR REPLACE VIEW ${queryViewName} AS ${query.sqlQuery}`
        : `CREATE VIEW IF NOT EXISTS" ${queryViewName} AS ${query.sqlQuery}`;
    await this.sequelize.query(viewQuery);
    this.views[viewName] = viewModel;
    const foundView = await this.models['Views'].findOne({ name: viewName });
    if (isNil(foundView)) {
      await this.models['Views'].create({
        name: viewName,
        originalSchema: modelName,
        joinedSchemas: [...new Set(joinedSchemas.concat(modelName))],
        query,
      });
    }
  }

  async deleteView(viewName: string): Promise<void> {
    if (this.views[viewName]) {
      await this.sequelize.query(`DROP VIEW IF EXISTS "${viewName}"`);
    }
    await this.models['Views'].deleteOne({ name: viewName });
    delete this.views[viewName];
  }

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

  async introspectSchema(table: Indexable, originalName: string): Promise<ConduitSchema> {
    sqlIntroSchemaConverter(table);
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
        cms: introspectedSchemaCmsOptionsDefaults,
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
    schema: ConduitDatabaseSchema,
    extractedSchemas: Indexable,
    associatedSchemas: { [key: string]: SequelizeSchema | SequelizeSchema[] },
  ) {
    for (const extractedSchema in extractedSchemas) {
      const modelOptions = merge({}, schema.modelOptions, {
        conduit: {
          cms: {
            enabled: false,
            crudOperations: {
              read: {
                enabled: false,
              },
              create: {
                enabled: false,
              },
              delete: {
                enabled: false,
              },
              update: {
                enabled: false,
              },
            },
          },

          permissions: {
            extendable: false,
            canCreate: false,
            canModify: 'Nothing',
            canDelete: false,
          },
        },
      });
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
      const sequelizeSchema = await this._createSchemaFromAdapter(
        modeledSchema as ConduitDatabaseSchema,
        false,
        {
          parentSchema: schema.name,
        },
      );
      associatedSchemas[extractedSchema] = isArray ? [sequelizeSchema] : sequelizeSchema;
    }
  }

  protected async _createSchemaFromAdapter(
    schema: ConduitDatabaseSchema,
    saveToDb: boolean = true,
    options?: { parentSchema: string },
  ): Promise<SequelizeSchema> {
    const compiledSchema = compileSchema(
      schema,
      this.registeredSchemas,
      this.sequelize.models,
    );
    const dialect = this.sequelize.getDialect();
    const [newSchema, objectPaths, extractedRelations] =
      dialect === 'postgres'
        ? pgSchemaConverter(compiledSchema, dialect)
        : sqlSchemaConverter(compiledSchema, dialect);
    this.registeredSchemas.set(
      schema.name,
      Object.freeze(JSON.parse(JSON.stringify(schema))),
    );
    const relatedSchemas = await resolveRelatedSchemas(
      schema,
      extractedRelations,
      this.models,
    );
    this.models[schema.name] = new SequelizeSchema(
      this.grpcSdk,
      this.sequelize,
      newSchema,
      schema,
      this,
      relatedSchemas,
      objectPaths,
    );

    const noSync = this.models[schema.name].originalSchema.modelOptions.conduit!.noSync;
    // do not sync extracted schemas
    if ((isNil(noSync) || !noSync) && !options) {
      await this.models[schema.name].sync();
    }
    // do not store extracted schemas to db
    if (!options && saveToDb) {
      await this.compareAndStoreMigratedSchema(schema);
      await this.saveSchemaToDatabase(schema);
    }
    return this.models[schema.name];
  }

  async deleteSchema(
    schemaName: string,
    deleteData: boolean,
    callerModule: string = 'database',
    instanceSync = false,
  ): Promise<string> {
    return await this._deleteSchema(schemaName, deleteData, callerModule, instanceSync);
  }

  private async _deleteSchema(
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

  getSchemaModel(schemaName: string): { model: SequelizeSchema } {
    if (this.models && this.models[schemaName]) {
      return { model: this.models[schemaName] };
    }
    throw new GrpcError(status.NOT_FOUND, `Schema ${schemaName} not defined yet`);
  }

  getDatabaseType(): string {
    return this.sequelize.getDialect();
  }

  async createIndex(
    schemaName: string,
    index: ModelOptionsIndex,
    callerModule: string,
  ): Promise<string> {
    if (!this.models[schemaName])
      throw new GrpcError(status.NOT_FOUND, 'Requested schema not found');
    index = this.checkAndConvertIndex(schemaName, index, callerModule);
    const schema = this.models[schemaName].originalSchema;
    const indexes = schema.modelOptions.indexes ?? [];
    if (!indexes.map(i => i.name).includes(index.name)) {
      indexes.push(index);
    }
    Object.assign(schema.modelOptions, { indexes });
    await this.createSchemaFromAdapter(schema);
    return 'Index created!';
  }

  async getIndexes(schemaName: string): Promise<ModelOptionsIndex[]> {
    if (!this.models[schemaName])
      throw new GrpcError(status.NOT_FOUND, 'Requested schema not found');
    const indexes: ModelOptionsIndex[] = [];
    // Find schema field indexes and convert them to modelOption indexes
    for (const [field, value] of Object.entries(
      this.models[schemaName].originalSchema.fields,
    )) {
      const index = (value as ConduitModelField).index;
      if (index) {
        indexes.push({
          name: index.name,
          fields: [field],
          types: index.type ? [index.type as SequelizeIndexType] : undefined,
          options: index.options ?? undefined,
        });
      }
    }
    indexes.push(...(this.models[schemaName].originalSchema.modelOptions.indexes ?? []));
    return indexes;
  }

  async deleteIndexes(schemaName: string, indexNames: string[]): Promise<string> {
    if (!this.models[schemaName])
      throw new GrpcError(status.NOT_FOUND, 'Requested schema not found');
    const foundSchema = await this.models['_DeclaredSchema'].findOne({
      name: schemaName,
    });
    const queryInterface = this.sequelize.getQueryInterface();
    let newSchema;
    for (const name of indexNames) {
      queryInterface
        .removeIndex(this.models[schemaName].originalSchema.collectionName, name)
        .catch(() => {
          throw new GrpcError(status.INTERNAL, 'Unsuccessful index deletion');
        });
      // Remove index from fields/compiledFields or modelOptions
      newSchema = findAndRemoveIndex(foundSchema, name);
    }
    await this.models['_DeclaredSchema'].findByIdAndUpdate(foundSchema!._id, newSchema);
    return 'Indexes deleted';
  }

  async execRawQuery(schemaName: string, rawQuery: RawSQLQuery) {
    return await this.sequelize
      .query(rawQuery.query, rawQuery.options)
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
  }

  async syncSchema(name: string) {
    await this.models[name].model.sync({ alter: true });
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

  private checkAndConvertIndex(
    schemaName: string,
    index: ModelOptionsIndex,
    callerModule: string,
  ) {
    const dialect = this.sequelize.getDialect();
    const { fields, types, options } = index;
    if (
      fields.some(
        field =>
          !Object.keys(this.models[schemaName].originalSchema.compiledFields).includes(
            field,
          ),
      )
    ) {
      throw new Error(`Invalid fields for index creation`);
    }
    if (!types && !options) return index;
    if (options) {
      if (!checkIfSequelizeIndexOptions(options, dialect)) {
        throw new GrpcError(
          status.INVALID_ARGUMENT,
          `Invalid index options for ${dialect}`,
        );
      }
      if (
        Object.keys(options).includes('unique') &&
        this.models[schemaName].originalSchema.ownerModule !== callerModule
      ) {
        throw new GrpcError(
          status.PERMISSION_DENIED,
          'Not authorized to create unique index',
        );
      }
    }
    if (types) {
      if (types.length !== 1 || !checkIfSequelizeIndexType(types[0], dialect)) {
        throw new GrpcError(status.INVALID_ARGUMENT, `Invalid index type for ${dialect}`);
      }
      if (
        (dialect === 'mysql' || dialect === 'mariadb') &&
        ['UNIQUE', 'FULLTEXT', 'SPATIAL'].includes(types[0] as string)
      ) {
        index.options = { ...index.options, type: types[0] } as MySQLMariaDBIndexOptions;
      } else {
        index.options = { ...index.options, using: types[0] } as PgIndexOptions;
      }
      delete index.types;
    }
    return index;
  }
}
