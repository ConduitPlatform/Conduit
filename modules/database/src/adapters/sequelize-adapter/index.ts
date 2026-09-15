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
  VectorCapabilities,
  VectorIndexDefinition,
  VectorSearchInput,
  VectorSearchResult,
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
  assertVectorSearchAccess,
  bindVectorIndexToField,
  completeVectorSearch,
  declaredVectorIndexes,
  fromPostgresVectorIndex,
  mergeVectorIndexes,
  pgVectorOperator,
  planPostgresVectorIndexCreate,
  planPostgresVectorSearch,
  postgresIndexMethodSql,
  postgresVectorCapabilities,
  parsePostgresVectorIndexDef,
  resolveVectorFieldFromSchema,
  sqlFallbackVectorCapabilities,
  assertPostgresVectorIndexDropTarget,
  type PostgresCatalogIndex,
} from '../utils/index.js';
import {
  assertUniqueIndexPrivilege,
  bindDeclaredIndexesToLive,
  ensureIndexName,
  findLiveIndex,
  inferSqlIndexType,
  isIndexAlreadyExistsError,
  isIndexKeySpecsConflictError,
  isPostgresIndexType,
  liveIndexFromSql,
  overlayDeclaredOnLive,
  normalizeIndexTypes,
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
    const live = isInstanceSync
      ? []
      : await this.listLiveIndexesForCollection(this.getCollectionName(schema));
    if (!isInstanceSync && schema.modelOptions.indexes?.length) {
      schema.modelOptions.indexes = bindDeclaredIndexesToLive(
        schema.modelOptions.indexes,
        live,
      );
      compiledSchema.modelOptions.indexes = schema.modelOptions.indexes;
    }
    const [newSchema, objectPaths, extractedRelations] =
      dialect === 'postgres'
        ? pgSchemaConverter(compiledSchema)
        : sqlSchemaConverter(compiledSchema, dialect as 'mysql' | 'mariadb' | 'sqlite');
    if (!isInstanceSync && newSchema.modelOptions.indexes?.length) {
      newSchema.modelOptions.indexes = bindDeclaredIndexesToLive(
        newSchema.modelOptions.indexes,
        live,
      );
    }
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
    await this.applyDeclaredVectorIndexes(schema.name, isInstanceSync);
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
    const collectionName = this.models[schemaName].originalSchema.collectionName;
    const live = await this.listLiveIndexesForCollection(collectionName);
    const prepared = bindDeclaredIndexesToLive(
      this.checkAndConvertIndexes(schemaName, indexes, callerModule, options?.privileged),
      live,
    );
    const queryInterface = this.sequelize.getQueryInterface();
    const applied: ModelOptionsIndexes[] = [];
    let failure: unknown;
    for (const index of prepared) {
      const existing = findLiveIndex(live, index);
      if (existing) {
        applied.push(index);
        continue;
      }
      try {
        await queryInterface.addIndex(collectionName, {
          fields: sqlIndexFields(index),
          ...index.options,
        });
        applied.push(index);
        live.push(index);
      } catch (e) {
        if (isIndexAlreadyExistsError(e)) {
          applied.push(index);
          continue;
        }
        if (isIndexKeySpecsConflictError(e)) {
          const relisted = await this.listLiveIndexesForCollection(collectionName);
          const match = findLiveIndex(relisted, index);
          if (match) {
            applied.push(bindDeclaredIndexesToLive([index], relisted)[0]);
            live.splice(0, live.length, ...relisted);
            continue;
          }
        }
        failure = e;
        break;
      }
    }
    if (!failure || applied.length > 0) {
      await this.persistIndexesAndPublish({
        schemaName,
        originalSchema: this.models[schemaName].originalSchema,
        applied,
      });
    }
    if (failure) {
      throw new GrpcError(status.INTERNAL, 'Unsuccessful index creation');
    }
    return 'Indexes created!';
  }

  private async listLiveIndexesForCollection(
    collectionName: string,
  ): Promise<ModelOptionsIndexes[]> {
    try {
      const result = (await this.sequelize
        .getQueryInterface()
        .showIndex(collectionName)) as UntypedArray;
      return result.map(liveIndexFromSql);
    } catch {
      return [];
    }
  }

  async getIndexes(schemaName: string): Promise<ModelOptionsIndexes[]> {
    if (!this.models[schemaName])
      throw new GrpcError(status.NOT_FOUND, 'Requested schema not found');
    const collectionName = this.models[schemaName].originalSchema.collectionName;
    const queryInterface = this.sequelize.getQueryInterface();
    const result = (await queryInterface.showIndex(collectionName)) as UntypedArray;
    const dialect = this.sequelize.getDialect();
    const declared = this.models[schemaName].originalSchema.modelOptions.indexes;
    return result.map(row => {
      const fields = (row.fields ?? []).map((field: unknown) =>
        typeof field === 'string' ? field : (field as { attribute?: string }).attribute,
      );
      const name = row.name as string;
      return overlayDeclaredOnLive(
        {
          name,
          fields,
          types: inferSqlIndexType(row, dialect),
          options: { name, unique: !!row.unique },
          ...(row.primary ? { primary: true } : {}),
        },
        declared,
      );
    });
  }

  async deleteIndexes(schemaName: string, indexNames: string[]): Promise<string> {
    if (!this.models[schemaName])
      throw new GrpcError(status.NOT_FOUND, 'Requested schema not found');
    const collectionName = this.models[schemaName].originalSchema.collectionName;
    const queryInterface = this.sequelize.getQueryInterface();
    const dropped: string[] = [];
    let failure: unknown;
    for (const name of indexNames) {
      try {
        await queryInterface.removeIndex(collectionName, name);
        dropped.push(name);
      } catch (e) {
        failure = e;
        break;
      }
    }
    const original = this.models[schemaName].originalSchema;
    for (const name of dropped) {
      removeIndexFromSchemaFields(original, name);
    }
    if (!failure || dropped.length > 0) {
      await this.persistIndexesAndPublish({
        schemaName,
        originalSchema: original,
        droppedNames: dropped,
      });
    }
    if (failure) {
      throw new GrpcError(status.INTERNAL, 'Unsuccessful index deletion');
    }
    return 'Indexes deleted';
  }

  async getVectorCapabilities(schemaName?: string): Promise<VectorCapabilities> {
    if (this.sequelize.getDialect() !== 'postgres') {
      return sqlFallbackVectorCapabilities(this.sequelize.getDialect());
    }
    try {
      await this.sequelize.query("SELECT 'vector'::regtype");
      return postgresVectorCapabilities({ pgvectorAvailable: true });
    } catch (err) {
      return postgresVectorCapabilities({
        pgvectorAvailable: false,
        error: (err as Error).message,
        schemaName,
      });
    }
  }

  async createVectorIndex(
    schemaName: string,
    index: VectorIndexDefinition,
  ): Promise<string> {
    this.ensurePostgresVectorSupport(schemaName);
    const schema = this.models[schemaName].originalSchema;
    const field = (schema.compiledFields?.[index.field] ??
      schema.fields?.[index.field]) as unknown;
    const tableName = this.getPhysicalTableName(schemaName);
    const bound = bindVectorIndexToField({
      provider: 'postgres',
      index,
      field,
      physicalTableName: tableName,
    });
    const existing = await this.findPostgresCatalogIndex(bound.name!);
    const method = postgresIndexMethodSql(bound.method);
    const operator = pgVectorOperator(bound.similarity);
    const withOptions =
      method === 'ivfflat'
        ? this.renderWithOptions({ lists: bound.options?.ivfflat?.lists })
        : this.renderWithOptions({
            m: bound.options?.hnsw?.m,
            ef_construction: bound.options?.hnsw?.efConstruction,
          });
    const plan = planPostgresVectorIndexCreate({
      indexName: bound.name!,
      tableName,
      field: bound.field,
      method,
      operator,
      withOptions,
      existing,
      quoteIdentifier: identifier => this.quoteIdentifier(identifier),
    });
    if (plan.action === 'reuse') return 'Vector index created!';
    await this.sequelize.query(plan.sql);
    return 'Vector index created!';
  }

  async getVectorIndexes(schemaName: string): Promise<VectorIndexDefinition[]> {
    this.ensurePostgresVectorSupport(schemaName);
    const tableName = this.getPhysicalTableName(schemaName);
    const rows = await this.listPostgresCatalogIndexes(tableName);
    const schema = this.models[schemaName]?.originalSchema;
    const schemaFields = (schema?.compiledFields ?? schema?.fields) as
      Record<string, unknown> | undefined;
    const declared = declaredVectorIndexes(schema ?? {});
    return rows
      .filter(row => /USING (hnsw|ivfflat)/i.test(row.indexdef))
      .map(row => {
        const parsed = parsePostgresVectorIndexDef(row.indexdef);
        const field = resolveVectorFieldFromSchema(schemaFields, parsed.field);
        const matchingDeclared = declared.find(
          item => item.name === row.indexname || item.field === parsed.field,
        );
        return fromPostgresVectorIndex(
          row.indexname,
          row.indexdef,
          field,
          matchingDeclared,
        );
      });
  }

  async deleteVectorIndex(schemaName: string, indexName: string): Promise<string> {
    this.ensurePostgresVectorSupport(schemaName);
    const tableName = this.getPhysicalTableName(schemaName);
    const existing = await this.findPostgresCatalogIndex(indexName);
    assertPostgresVectorIndexDropTarget({
      indexName,
      tableName,
      existing,
    });
    await this.sequelize.query(`DROP INDEX ${this.quoteIdentifier(indexName)}`);
    return 'Vector index deleted';
  }

  async vectorSearch(request: VectorSearchInput): Promise<VectorSearchResult[]> {
    this.ensurePostgresVectorSupport(request.schemaName);
    const schema = this.models[request.schemaName];
    const schemaFields = (schema.originalSchema.compiledFields ??
      schema.originalSchema.fields) as Record<string, unknown>;
    const field = resolveVectorFieldFromSchema(schemaFields, request.field);
    if (!field) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Requested field is not a vector');
    }
    if (request.vector.length !== field.dimensions) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        `Vector dimensions mismatch: expected ${field.dimensions}`,
      );
    }
    assertVectorSearchAccess({
      authzEnabled: !!schema.authzEnabled,
      userId: request.userId,
      scope: request.scope,
      adminOperator: request.adminOperator,
    });
    const liveIndexes = await this.getVectorIndexes(request.schemaName);
    const planned = planPostgresVectorSearch({
      request,
      indexes: mergeVectorIndexes(
        declaredVectorIndexes(schema.originalSchema),
        liveIndexes,
      ),
      schemaFields,
      tableName: this.getPhysicalTableName(request.schemaName),
      similarity: field.similarity,
      renderer: {
        quoteIdentifier: identifier => this.quoteIdentifier(identifier),
        escape: value => this.sequelize.escape(value as string | number),
      },
    });
    return completeVectorSearch({
      emptyResult: planned.emptyResult,
      limit: planned.limits.limit,
      authzEnabled: !!schema.authzEnabled,
      adminOperator: request.adminOperator,
      provider: 'postgres',
      metric: field.similarity,
      fetchCandidates: async () => {
        const rows = await this.sequelize.query(planned.sql);
        return (rows[0] as Indexable[]) ?? [];
      },
      lookupAuthorizedIds: ids =>
        schema.lookupAuthorizedCandidateIds('read', ids, request.userId, request.scope),
    });
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

  private ensurePostgresVectorSupport(schemaName: string) {
    if (this.sequelize.getDialect() !== 'postgres') {
      throw new GrpcError(
        status.UNIMPLEMENTED,
        `${this.sequelize.getDialect()} does not support vector search`,
      );
    }
    if (!this.models[schemaName]) {
      throw new GrpcError(status.NOT_FOUND, 'Requested schema not found');
    }
  }

  private async listPostgresCatalogIndexes(
    tableName?: string,
  ): Promise<PostgresCatalogIndex[]> {
    const tableFilter = tableName
      ? ` AND tablename = ${this.sequelize.escape(tableName)}`
      : '';
    const rows = await this.sequelize.query(
      `SELECT indexname, tablename, indexdef FROM pg_indexes WHERE schemaname = current_schema()${tableFilter}`,
    );
    return ((rows[0] as PostgresCatalogIndex[]) ?? []).map(row => ({
      indexname: row.indexname,
      tablename: row.tablename,
      indexdef: row.indexdef,
    }));
  }

  private async findPostgresCatalogIndex(
    indexName: string,
  ): Promise<PostgresCatalogIndex | undefined> {
    const rows = await this.sequelize.query(
      `SELECT indexname, tablename, indexdef FROM pg_indexes WHERE schemaname = current_schema() AND indexname = ${this.sequelize.escape(
        indexName,
      )}`,
    );
    return ((rows[0] as PostgresCatalogIndex[]) ?? [])[0];
  }

  private getPhysicalTableName(schemaName: string) {
    return this.models[schemaName].originalSchema.collectionName || `cnd_${schemaName}`;
  }

  private quoteIdentifier(identifier: string) {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  private renderWithOptions(options: Record<string, number | undefined>) {
    const entries = Object.entries(options).filter((entry): entry is [string, number] =>
      Number.isFinite(entry[1]),
    );
    if (!entries.length) return '';
    return ` WITH (${entries.map(([key, value]) => `${key} = ${value}`).join(', ')})`;
  }

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
