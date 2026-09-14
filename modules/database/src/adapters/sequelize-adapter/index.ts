import { Sequelize } from 'sequelize';
import {
  ConduitGrpcSdk,
  ConduitModel,
  ConduitSchema,
  GrpcError,
  Indexable,
  ModelOptionsIndexes,
  PostgresIndexType,
  RawSQLQuery,
  UntypedArray,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { SequelizeAuto } from 'sequelize-auto';
import { DatabaseAdapter } from '../DatabaseAdapter.js';
import { SequelizeSchema } from './SequelizeSchema.js';
import {
  checkIfPostgresOptions,
  compileSchema,
  resolveRelatedSchemas,
  tableFetch,
} from './utils/index.js';
import { sqlIntroSchemaConverter } from '../../introspection/sequelize/utils.js';
import {
  ConduitDatabaseSchema,
  introspectedSchemaCmsOptionsDefaults,
} from '../../interfaces/index.js';
import { sqlSchemaConverter } from './sql-adapter/SqlSchemaConverter.js';
import { pgSchemaConverter } from './postgres-adapter/PgSchemaConverter.js';
import { isEqual, isNil } from 'lodash-es';
import {
  assertUniqueIndexPrivilege,
  declaredIndexMap,
  ensureIndexName,
  inferSqlIndexType,
  isIndexAlreadyExistsError,
  isPostgresIndexType,
  mergeDeclaredIndexes,
  normalizeIndexTypes,
  persistDeclaredSchemaIndexes,
  removeDeclaredIndexes,
  removeIndexFromSchemaFields,
  sqlDialectAllowsIndexType,
  sqlIndexFields,
  toMutableIndexes,
  validateIndexFields,
} from '../utils/indexes.js';

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
    const existingView = this.views[viewName];
    const isQueryEqual = isEqual(existingView?.viewQuery, query);
    if (existingView && isQueryEqual) {
      return;
    }

    const model = this.models[modelName];
    const newSchema = JSON.parse(JSON.stringify(model.schema));
    newSchema.name = viewName;
    newSchema.collectionName = viewName;

    if (existingView && !isQueryEqual) {
      await this.deleteView(viewName, true);
    }
    const viewModel = new SequelizeSchema(
      this.grpcSdk,
      this.sequelize,
      newSchema,
      model.originalSchema,
      this,
      model.extractedRelations,
      model.objectPaths,
      true,
      query,
    );
    const dialect = this.sequelize.getDialect();
    const queryViewName = dialect === 'postgres' ? `"${viewName}"` : viewName;
    const viewQuery =
      dialect !== 'sqlite'
        ? `CREATE OR REPLACE VIEW ${queryViewName} AS ${query.sqlQuery}`
        : `CREATE VIEW IF NOT EXISTS" ${queryViewName} AS ${query.sqlQuery}`;
    await this.sequelize.query(viewQuery).catch(err => {
      if (
        err.name !== 'SequelizeUniqueConstraintError' &&
        (err.name !== 'SequelizeDatabaseError' || !err.message.includes('already exists'))
      ) {
        throw err;
      }
    });
    this.views[viewName] = viewModel;
    const foundView = await this.models['Views'].findOne({ name: viewName });
    if (isNil(foundView)) {
      await this.models['Views']
        .create({
          name: viewName,
          originalSchema: modelName,
          joinedSchemas: [...new Set(joinedSchemas.concat(modelName))],
          query,
          lastAccessedAt: new Date(),
        })
        .catch(err => {
          if (err.name !== 'SequelizeUniqueConstraintError') {
            throw err;
          }
        });
    }
  }

  async guaranteeView(viewName: string) {
    const view = await this.models['Views'].findOne({
      name: viewName,
    });
    if (!view) {
      throw new Error('View not found');
    }
    await this.createView(view.originalSchema, view.name, view.joinedSchemas, view.query);
    return this.views[viewName];
  }

  async deleteView(viewName: string, instanceSync = false): Promise<void> {
    if (this.views[viewName]) {
      await this.sequelize.query(`DROP VIEW IF EXISTS "${viewName}"`);
    }
    await this.models['Views'].deleteOne({ name: viewName });
    delete this.views[viewName];
    if (!instanceSync) {
      this.publishViewDeletion(viewName);
    }
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

  protected async _createSchemaFromAdapter(
    schema: ConduitDatabaseSchema,
    saveToDb: boolean = true,
    isInstanceSync: boolean = false,
  ): Promise<SequelizeSchema> {
    for (const [key, value] of Object.entries(this.views)) {
      if (value.originalSchema.name === schema.name) {
        await this.deleteView(key);
      }
    }
    const compiledSchema = compileSchema(
      schema,
      this.registeredSchemas,
      this.sequelize.models,
    );
    const dialect = this.sequelize.getDialect();
    const [newSchema, objectPaths, extractedRelations] =
      dialect === 'postgres'
        ? pgSchemaConverter(compiledSchema)
        : sqlSchemaConverter(compiledSchema, dialect as 'mysql' | 'mariadb' | 'sqlite');
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

    const noSync =
      this.models[schema.name].originalSchema.modelOptions.conduit!.noSync ||
      isInstanceSync;
    // do not sync extracted schemas
    if (isNil(noSync) || !noSync) {
      await this.models[schema.name].sync();
    } else {
      this.models[schema.name].synced = true;
    }
    // do not store extracted schemas to db
    if (saveToDb && !isInstanceSync) {
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
    } else if (this.views && this.views[schemaName]) {
      return { model: this.views[schemaName] };
    }
    throw new GrpcError(status.NOT_FOUND, `Schema ${schemaName} not defined yet`);
  }

  getDatabaseType(): string {
    const type = this.sequelize.getDialect();
    if (type === 'postgres') {
      return 'PostgreSQL'; // TODO: clean up
    }
    return type;
  }

  generateId(): string {
    return crypto.randomUUID();
  }

  async createIndexes(
    schemaName: string,
    indexes: readonly ModelOptionsIndexes[],
    callerModule: string,
    options?: { privileged?: boolean },
  ): Promise<string> {
    if (!this.models[schemaName])
      throw new GrpcError(status.NOT_FOUND, 'Requested schema not found');
    const prepared = this.checkAndConvertIndexes(
      schemaName,
      indexes,
      callerModule,
      options?.privileged,
    );
    const collectionName = this.models[schemaName].originalSchema.collectionName;
    const queryInterface = this.sequelize.getQueryInterface();
    for (const index of prepared) {
      try {
        await queryInterface.addIndex(collectionName, {
          fields: sqlIndexFields(index),
          ...index.options,
        });
      } catch (e) {
        if (isIndexAlreadyExistsError(e)) continue;
        throw new GrpcError(status.INTERNAL, 'Unsuccessful index creation');
      }
    }
    const original = this.models[schemaName].originalSchema;
    const merged = mergeDeclaredIndexes(original.modelOptions.indexes, prepared);
    await persistDeclaredSchemaIndexes({
      declaredSchemaModel: this.models['_DeclaredSchema'],
      schemaName,
      originalSchema: original,
      indexes: merged,
    });
    return 'Indexes created!';
  }

  async getIndexes(schemaName: string): Promise<ModelOptionsIndexes[]> {
    if (!this.models[schemaName])
      throw new GrpcError(status.NOT_FOUND, 'Requested schema not found');
    const collectionName = this.models[schemaName].originalSchema.collectionName;
    const queryInterface = this.sequelize.getQueryInterface();
    const result = (await queryInterface.showIndex(collectionName)) as UntypedArray;
    const dialect = this.sequelize.getDialect();
    const declaredByName = declaredIndexMap(
      this.models[schemaName].originalSchema.modelOptions.indexes,
    );
    return result.map(row => {
      const fields = (row.fields ?? []).map((field: unknown) =>
        typeof field === 'string' ? field : (field as { attribute?: string }).attribute,
      );
      const name = row.name as string;
      const declaredIndex = declaredByName.get(name);
      const live: ModelOptionsIndexes = {
        name,
        fields,
        types: inferSqlIndexType(row, dialect),
        options: { name, unique: !!row.unique },
      };
      if (!declaredIndex) return live;
      return {
        ...live,
        types: declaredIndex.types ?? live.types,
        options: { ...declaredIndex.options, ...live.options, name },
      };
    });
  }

  async deleteIndexes(schemaName: string, indexNames: string[]): Promise<string> {
    if (!this.models[schemaName])
      throw new GrpcError(status.NOT_FOUND, 'Requested schema not found');
    const collectionName = this.models[schemaName].originalSchema.collectionName;
    const queryInterface = this.sequelize.getQueryInterface();
    for (const name of indexNames) {
      try {
        await queryInterface.removeIndex(collectionName, name);
      } catch {
        throw new GrpcError(status.INTERNAL, 'Unsuccessful index deletion');
      }
    }
    const original = this.models[schemaName].originalSchema;
    for (const name of indexNames) {
      removeIndexFromSchemaFields(original, name);
    }
    const remaining = removeDeclaredIndexes(original.modelOptions.indexes, indexNames);
    await persistDeclaredSchemaIndexes({
      declaredSchemaModel: this.models['_DeclaredSchema'],
      schemaName,
      originalSchema: original,
      indexes: remaining,
    });
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
        await ConduitGrpcSdk.Sleep(200);
      }
    }
    if (error) {
      ConduitGrpcSdk.Logger.error('Unable to connect to the database: ', error);
      throw new Error();
    }
  }

  protected abstract hasLegacyCollections(): Promise<boolean>;

  private checkAndConvertIndexes(
    schemaName: string,
    indexes: readonly ModelOptionsIndexes[],
    callerModule: string,
    privileged?: boolean,
  ): ModelOptionsIndexes[] {
    const schema = this.models[schemaName].originalSchema;
    const dialect = this.sequelize.getDialect();
    const prepared: ModelOptionsIndexes[] = [];
    for (const raw of toMutableIndexes(indexes)) {
      const index = ensureIndexName(raw);
      validateIndexFields(schema, index);
      if (index.types) {
        const types = normalizeIndexTypes(index.types, index.fields.length) ?? [];
        if (types.some(type => !sqlDialectAllowsIndexType(dialect, type))) {
          throw new GrpcError(
            status.INVALID_ARGUMENT,
            `Invalid index type for ${dialect}`,
          );
        }
        const first = types[0];
        const using =
          types.length === 1 && isPostgresIndexType(first)
            ? first
            : PostgresIndexType.BTREE;
        index.options = {
          ...(index.options ?? {}),
          using,
        };
      }
      if (index.options) {
        if (!checkIfPostgresOptions(index.options)) {
          throw new GrpcError(
            status.INVALID_ARGUMENT,
            `Invalid index options for ${dialect}`,
          );
        }
        assertUniqueIndexPrivilege({
          unique: index.options.unique === true,
          schemaOwner: schema.ownerModule,
          callerModule,
          privileged,
        });
      }
      prepared.push(index);
    }
    return prepared;
  }
}
