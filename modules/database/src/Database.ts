import {
  ConduitGrpcSdk,
  ConduitModel,
  ConduitSchema,
  GrpcRequest,
  GrpcResponse,
  HealthCheckStatus,
  VectorIndexDefinition,
  VectorSimilarity,
  defaultVectorIndexMethod,
  parseErrorPayload,
} from '@conduitplatform/grpc-sdk';
import { AdminHandlers } from './admin/index.js';
import { SchemaAdmin } from './admin/schema.admin.js';
import { CustomEndpointsAdmin } from './admin/customEndpoints/customEndpoints.admin.js';
import { DatabaseRoutes } from './routes/index.js';
import * as models from './models/index.js';
import { DATABASE_SYSTEM_SCHEMAS } from './models/systemSchemas.js';
import {
  ColumnExistenceRequest,
  ColumnExistenceResponse,
  CreateViewRequest,
  DeleteViewRequest,
  DropCollectionRequest,
  DropCollectionResponse,
  FindOneRequest,
  FindRequest,
  GetDatabaseTypeResponse,
  GetSchemaRequest,
  GetSchemasRequest,
  MigrateRequest,
  QueryRequest,
  QueryResponse,
  RawQueryRequest,
  Schema as SchemaDto,
  UpdateManyRequest,
  UpdateRequest,
  DeleteVectorIndexRequest,
  VectorCapabilitiesRequest,
  VectorCapabilitiesResponse,
  VectorIndex,
  VectorIndexListRequest,
  VectorIndexListResponse,
  VectorIndexRequest,
  VectorSearchRequest,
} from './protoTypes/database.js';
import {
  CreateSchemaExtensionRequest,
  SchemaResponse,
  SchemasResponse,
} from './types.js';
import { DatabaseAdapter } from './adapters/DatabaseAdapter.js';
import { MongooseAdapter } from './adapters/mongoose-adapter/index.js';
import { MongooseSchema } from './adapters/mongoose-adapter/MongooseSchema.js';
import { SequelizeSchema } from './adapters/sequelize-adapter/SequelizeSchema.js';
import { ConduitDatabaseSchema, IView, Schema } from './interfaces/index.js';
import {
  canCreate,
  canDelete,
  canModify,
  vectorIndexDeleteMutationData,
  vectorIndexMutationData,
} from './permissions/index.js';
import { runMigrations } from './migrations/index.js';
import { SchemaController } from './controllers/cms/schema.controller.js';
import { CustomEndpointController } from './controllers/customEndpoints/customEndpoint.controller.js';
import { SchemaConverter } from './utils/SchemaConverter.js';
import path from 'path';
import metricsSchema from './metrics/index.js';
import { isNil } from 'lodash-es';
import { PostgresAdapter } from './adapters/sequelize-adapter/postgres-adapter/index.js';
import { SQLAdapter } from './adapters/sequelize-adapter/sql-adapter/index.js';
import {
  ConfigController,
  grpcCallbackError,
  ManagedModule,
  ModuleError,
  type ExportableResource,
  type ExportResult,
  type ImportResult,
} from '@conduitplatform/module-tools';
import { QueueController } from './controllers/queue.controller.js';
import {
  buildMutationEventChunks,
  collectBoundedMutationIds,
  mutationEventChannel,
  shouldPublishMutationEvent,
  callerModuleName,
  resolveAdminOperatorContext,
  assertVectorSearchAccess,
  assertEmbeddingsJobCaller,
  assertEmbeddingsJobRead,
  assertEmbeddingsJobWrite,
} from './adapters/utils/index.js';
import AppConfigSchema, { Config } from './config/index.js';
import { Empty } from './protoTypes/google/protobuf/empty.js';
import { fileURLToPath } from 'node:url';
import { RealtimeService } from './realtime/index.js';
import { errors } from './errors.js';

function importErrorText(e: unknown): string {
  const { message, conduitCode } = parseErrorPayload(e);
  return conduitCode ? `${conduitCode}: ${message}` : message;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class DatabaseModule extends ManagedModule<Config> {
  configSchema = AppConfigSchema;
  service = {
    protoPath: path.resolve(__dirname, 'database.proto'),
    protoDescription: 'database.DatabaseProvider',
    functions: {
      createSchemaFromAdapter: this.createSchemaFromAdapter.bind(this),
      getSchema: this.getSchema.bind(this),
      getSchemas: this.getSchemas.bind(this),
      deleteSchema: this.deleteSchema.bind(this),
      setSchemaExtension: this.setSchemaExtension.bind(this),
      findOne: this.findOne.bind(this),
      findMany: this.findMany.bind(this),
      create: this.create.bind(this),
      createMany: this.createMany.bind(this),
      createView: this.createView.bind(this),
      deleteView: this.deleteView.bind(this),
      findByIdAndUpdate: this.findByIdAndUpdate.bind(this),
      findByIdAndReplace: this.findByIdAndReplace.bind(this),
      replaceOne: this.replaceOne.bind(this),
      updateOne: this.updateOne.bind(this),
      updateMany: this.updateMany.bind(this),
      deleteOne: this.deleteOne.bind(this),
      deleteMany: this.deleteMany.bind(this),
      countDocuments: this.countDocuments.bind(this),
      rawQuery: this.rawQuery.bind(this),
      columnExistence: this.columnExistence.bind(this),
      migrate: this.migrate.bind(this),
      getDatabaseType: this.getDatabaseType.bind(this),
      generateId: this.generateId.bind(this),
      getVectorCapabilities: this.getVectorCapabilities.bind(this),
      createVectorIndex: this.createVectorIndex.bind(this),
      getVectorIndexes: this.getVectorIndexes.bind(this),
      deleteVectorIndex: this.deleteVectorIndex.bind(this),
      vectorSearch: this.vectorSearch.bind(this),
    },
  };
  protected metricsSchema = metricsSchema;
  private adminRouter?: AdminHandlers;
  private userRouter?: DatabaseRoutes;
  private readonly _activeAdapter: DatabaseAdapter<MongooseSchema | SequelizeSchema>;
  private schemaController?: SchemaController;
  private customEndpointController?: CustomEndpointController;
  private _authorizationDefinitionsRegistered = false;
  private _databaseRouterWatchDispose: (() => void) | null = null;
  private realtimeService?: RealtimeService;

  constructor(dbType: string, dbUri: string, peerManifestRoot?: string) {
    super('database', peerManifestRoot);
    this.updateHealth(HealthCheckStatus.UNKNOWN, true);
    if (dbType === 'mongodb') {
      this._activeAdapter = new MongooseAdapter(dbUri);
    } else if (dbType === 'postgres') {
      this._activeAdapter = new PostgresAdapter(dbUri);
    } else if (['mariadb', 'mysql', 'sqlite'].includes(dbType)) {
      this._activeAdapter = new SQLAdapter(dbUri);
    } else {
      throw new Error('Database type not supported');
    }
  }

  async preServerStart() {
    await this._activeAdapter.init(this.grpcSdk);
    await this.registerMetrics();
  }

  async onServerStart() {
    const isReplica = this.grpcSdk.isAvailable('database');
    await this._activeAdapter.registerSystemSchema(models.DeclaredSchema, isReplica);
    await this._activeAdapter.registerSystemSchema(models.MigratedSchemas, isReplica);
    for (const model of DATABASE_SYSTEM_SCHEMAS) {
      if (
        model.name === models.DeclaredSchema.name ||
        model.name === models.MigratedSchemas.name
      ) {
        continue;
      }
      await this._activeAdapter.registerSystemSchema(model, isReplica);
    }
    await this._activeAdapter.retrieveForeignSchemas();
    await this._activeAdapter.recoverSchemasFromDatabase();
    await this._activeAdapter.recoverViewsFromDatabase();
    if (!isReplica) {
      await runMigrations(this._activeAdapter);
    }
    for (const model of DATABASE_SYSTEM_SCHEMAS) {
      await this._activeAdapter.registerSystemSchema(model, isReplica);
      if (this._activeAdapter.getDatabaseType() !== 'MongoDB' && !isReplica) {
        await this._activeAdapter.syncSchema(model.name);
      }
    }
    this.updateHealth(HealthCheckStatus.SERVING);
  }

  async onConfig() {
    const config = ConfigController.getInstance().config;
    if (!config) return;

    if (this._activeAdapter.getDatabaseType() === 'MongoDB') {
      this._activeAdapter.updateQueryDefaults({
        readPreference: config.readPreference ?? 'primary',
        writeConcern: config.writeConcern ?? '1',
        readConcern: config.readConcern ?? 'local',
      });
    }
    void this.realtimeService?.reconcile();
    if (!config.viewCleanup.enabled) {
      try {
        await QueueController.getInstance().drainViewCleanupQueue();
      } catch {
        // Queue was never initialized (cleanup stayed disabled).
      }
      return;
    }
    const queueController = QueueController.getInstance(this.grpcSdk);
    await queueController.drainViewCleanupQueue();
    queueController.addViewCleanupWorker(job =>
      this._activeAdapter.cleanUpStaleViews(
        job.data.stalenessThresholdMs,
        job.data.batchSize,
      ),
    );
    if (!config.viewCleanup.cronPattern) {
      ConduitGrpcSdk.Logger.warn(
        'View cleanup is enabled but no cronPattern is set. Skipping job scheduling.',
      );
      return;
    }
    const repeatOptions = {
      pattern: config.viewCleanup.cronPattern,
    };
    await queueController.addViewCleanupJob(
      config.viewCleanup.stalenessThresholdMs,
      config.viewCleanup.batchSize,
      repeatOptions,
    );
  }

  async onRegister() {
    this.registerInstanceSyncEvents();
    const coreHealth = (await this.grpcSdk.core.check()) as unknown as HealthCheckStatus;
    this.onCoreHealthChange(coreHealth);
    this.grpcSdk.core.watch('');
    this.registerDeclaredPeerWatches();
  }

  protected onDeclaredPeerConnectionUpdate(moduleName: string, serving: boolean): void {
    if (
      moduleName !== 'authorization' ||
      !serving ||
      this._authorizationDefinitionsRegistered
    ) {
      return;
    }
    this._authorizationDefinitionsRegistered = true;
    void this._activeAdapter.registerAuthorizationDefinitions();
  }

  async initializeMetrics() {
    const customEndpointsTotal = await this._activeAdapter
      .getSchemaModel('CustomEndpoints')
      .model.countDocuments({});
    ConduitGrpcSdk.Metrics?.set('custom_endpoints_total', customEndpointsTotal);
  }

  // Framework export/import (GitOps)
  protected getExportableResources(): ExportableResource[] {
    return [
      { type: 'schemas', description: 'CMS schemas', priority: 10 },
      {
        type: 'extensions',
        description: 'Schema extensions (database-owned)',
        priority: 11,
      },
      { type: 'customEndpoints', description: 'Custom endpoints', priority: 20 },
    ];
  }

  protected async exportResources(resourceTypes?: string[]): Promise<ExportResult> {
    if (!this.schemaController || !this.customEndpointController) return {};
    const schemaAdmin = new SchemaAdmin(
      this.grpcSdk,
      this._activeAdapter,
      this.schemaController,
      this.customEndpointController,
    );
    const schemaExport = await schemaAdmin.exportSchemas();
    const customEndpointsAdmin = new CustomEndpointsAdmin(
      this.grpcSdk,
      this._activeAdapter,
      this.customEndpointController,
    );
    const endpointExport = await customEndpointsAdmin.exportCustomEndpoints();
    const all: ExportResult = {
      schemas: (schemaExport as { schemas: unknown[] }).schemas ?? [],
      extensions: (schemaExport as { extensions: unknown[] }).extensions ?? [],
      customEndpoints: (endpointExport as { endpoints: unknown[] }).endpoints ?? [],
    };
    if (!resourceTypes || resourceTypes.length === 0) return all;
    const out: ExportResult = {};
    for (const t of resourceTypes) {
      if (all[t]) out[t] = all[t];
    }
    return out;
  }

  protected async importResources(data: ExportResult): Promise<ImportResult> {
    if (!this.schemaController || !this.customEndpointController) return {};
    const result: ImportResult = {
      schemas: { created: 0, updated: 0, failed: 0, errors: [] },
      extensions: { created: 0, updated: 0, failed: 0, errors: [] },
      customEndpoints: { created: 0, updated: 0, failed: 0, errors: [] },
    };
    const schemaAdmin = new SchemaAdmin(
      this.grpcSdk,
      this._activeAdapter,
      this.schemaController,
      this.customEndpointController,
    );
    const customEndpointsAdmin = new CustomEndpointsAdmin(
      this.grpcSdk,
      this._activeAdapter,
      this.customEndpointController,
    );
    if (data.schemas?.length || data.extensions?.length) {
      try {
        await schemaAdmin.importSchemas({
          request: {
            params: { schemas: data.schemas ?? [], extensions: data.extensions ?? [] },
          },
        } as any);
      } catch (e) {
        result.schemas.failed =
          (data.schemas?.length ?? 0) + (data.extensions?.length ?? 0);
        result.schemas.errors.push(importErrorText(e));
      }
    }
    if (data.customEndpoints?.length) {
      try {
        await customEndpointsAdmin.importCustomEndpoints({
          request: { params: { endpoints: data.customEndpoints } },
        } as any);
        result.customEndpoints.created = data.customEndpoints.length;
      } catch (e) {
        result.customEndpoints.failed = data.customEndpoints.length;
        result.customEndpoints.errors.push(importErrorText(e));
      }
    }
    return result;
  }

  // gRPC Service
  /**
   * Should accept a JSON schema and output a .ts interface for the adapter
   * @param call
   * @param callback
   */
  async createSchemaFromAdapter(call: GrpcRequest<SchemaDto>, callback: SchemaResponse) {
    let schema: ConduitSchema;
    try {
      schema = new ConduitSchema(
        call.request.name,
        JSON.parse(call.request.fields),
        JSON.parse(call.request.modelOptions),
        call.request.collectionName,
      );
    } catch (err) {
      return callback(
        grpcCallbackError(
          err instanceof SyntaxError
            ? {
                ...errors.SCHEMA_FIELDS_INVALID,
                message: 'Schema fields or model options are not valid JSON',
              }
            : err,
          errors.SCHEMA_OPERATION_FAILED,
        ),
      );
    }
    if (schema.name.indexOf('-') >= 0 || schema.name.indexOf(' ') >= 0) {
      return callback(grpcCallbackError(errors.SCHEMA_NAME_INVALID));
    }
    schema.ownerModule = call.metadata!.get('module-name')![0] as string;
    await this._activeAdapter
      .createSchemaFromAdapter(schema, false, true)
      .then((schemaAdapter: Schema) => {
        callback(
          null,
          SchemaConverter.dbToGrpc(
            this._activeAdapter,
            schemaAdapter.originalSchema as ConduitDatabaseSchema,
          ),
        ); // @dirty-type-cast
      })
      .catch(err => {
        callback(grpcCallbackError(err, errors.SCHEMA_OPERATION_FAILED));
      });
  }

  /**
   * Given a schema name, returns the schema adapter assigned
   * @param call
   * @param callback
   */
  getSchema(call: GrpcRequest<GetSchemaRequest>, callback: SchemaResponse) {
    try {
      const schemaAdapter = this._activeAdapter.getSchema(call.request.schemaName);
      callback(
        null,
        SchemaConverter.dbToGrpc(
          this._activeAdapter,
          schemaAdapter as ConduitDatabaseSchema,
        ),
      ); // @dirty-type-cast
    } catch (err) {
      callback(grpcCallbackError(err, errors.SCHEMA_OPERATION_FAILED));
    }
  }

  /**
   * Given a schema name, returns the schema adapter assigned
   * @param call
   * @param callback
   */
  async createView(call: GrpcRequest<CreateViewRequest>, callback: GrpcResponse<Empty>) {
    try {
      await this._activeAdapter.createViewFromAdapter({
        modelName: call.request.schemaName,
        viewName: call.request.viewName,
        joinedSchemas: call.request.joinedSchemas,
        query: call.request.query,
      });
      callback(null, {});
    } catch (err) {
      callback(grpcCallbackError(err, errors.VIEW_OPERATION_FAILED));
    }
  }

  /**
   * Given a schema name, returns the schema adapter assigned
   * @param call
   * @param callback
   */
  async deleteView(call: GrpcRequest<DeleteViewRequest>, callback: GrpcResponse<Empty>) {
    try {
      await this._activeAdapter.deleteView(call.request.viewName);
      callback(null, {});
    } catch (err) {
      callback(grpcCallbackError(err, errors.VIEW_OPERATION_FAILED));
    }
  }

  getSchemas(call: GrpcRequest<GetSchemasRequest>, callback: SchemasResponse) {
    try {
      const schemas = this._activeAdapter.getSchemas();
      callback(null, {
        schemas: schemas.map(schema =>
          SchemaConverter.dbToGrpc(this._activeAdapter, schema as ConduitDatabaseSchema),
        ), // @dirty-type-cast
      });
    } catch (err) {
      callback(grpcCallbackError(err, errors.SCHEMA_OPERATION_FAILED));
    }
  }

  async deleteSchema(
    call: GrpcRequest<DropCollectionRequest>,
    callback: GrpcResponse<DropCollectionResponse>,
  ) {
    try {
      const schemas = await this._activeAdapter.deleteSchema(
        call.request.schemaName,
        call.request.deleteData,
        call.metadata!.get('module-name')![0] as string as string,
      );
      callback(null, { result: schemas });
    } catch (err) {
      callback(grpcCallbackError(err, errors.SCHEMA_OPERATION_FAILED));
    }
  }

  /**
   * Create, update or delete caller module's extension for target schema
   * @param call
   * @param callback
   */
  async setSchemaExtension(call: CreateSchemaExtensionRequest, callback: SchemaResponse) {
    try {
      const schemaName = call.request.schemaName;
      const extOwner = call.metadata!.get('module-name')![0] as string;
      const extModel: ConduitModel = JSON.parse(call.request.fields);
      const schema = this._activeAdapter.getSchema(schemaName);
      if (!schema) {
        throw new ModuleError(errors.SCHEMA_NOT_FOUND);
      }
      await this._activeAdapter
        .setSchemaExtension(schemaName, extOwner, extModel)
        .then((schemaAdapter: Schema) => {
          callback(
            null,
            SchemaConverter.dbToGrpc(
              this._activeAdapter,
              schemaAdapter.originalSchema as ConduitDatabaseSchema,
            ),
          ); // @dirty-type-cast
        })
        .catch(err => {
          callback(grpcCallbackError(err, errors.SCHEMA_OPERATION_FAILED));
        });
    } catch (err) {
      callback(grpcCallbackError(err, errors.SCHEMA_OPERATION_FAILED));
    }
  }

  async findOne(
    call: GrpcRequest<FindOneRequest>,
    callback: GrpcResponse<QueryResponse>,
  ) {
    try {
      const schemaAdapter = this._activeAdapter.getSchemaModel(call.request.schemaName);
      if (call.request.embeddingsJob) {
        assertEmbeddingsJobCaller(callerModuleName(call.metadata));
        assertEmbeddingsJobRead({
          query: call.request.query,
          select: call.request.select,
          allowedFields: call.request.embeddingsAllowedFields,
          schema: schemaAdapter.model.originalSchema as ConduitDatabaseSchema,
        });
      }
      const doc = await schemaAdapter.model.findOne(call.request.query, {
        select: call.request.select,
        populate: call.request.populate,
        userId: call.request.userId,
        scope: call.request.scope,
        readPreference: call.request.readPreference,
      });
      callback(null, { result: JSON.stringify(doc) });
    } catch (err) {
      callback(grpcCallbackError(err, errors.DATABASE_OPERATION_FAILED));
    }
  }

  async findMany(call: GrpcRequest<FindRequest>, callback: GrpcResponse<QueryResponse>) {
    try {
      const { skip, limit, select, populate } = call.request;
      const _sort = call.request.sort as { [field: string]: -1 | 1 | number };
      // gRPC undefined object field values fall back to  empty objects...
      let sort: { [field: string]: -1 | 1 } | undefined = undefined;
      if (_sort && !!Object.keys(_sort).length) {
        for (const field of Object.keys(_sort)) {
          if (_sort[field] !== 1 && _sort[field] !== -1) {
            return callback(
              grpcCallbackError({
                ...errors.SORT_INVALID,
                message: `Invalid sort field value "${_sort[field]}" in field "${field}", should be -1 or 1.`,
              }),
            );
          }
        }
        sort = _sort as { [field: string]: -1 | 1 };
      }
      const schemaAdapter = this._activeAdapter.getSchemaModel(call.request.schemaName);
      const docs = await schemaAdapter.model.findMany(call.request.query, {
        skip,
        limit,
        select,
        sort,
        populate,
        userId: call.request.userId,
        scope: call.request.scope,
        readPreference: call.request.readPreference,
      });
      callback(null, { result: JSON.stringify(docs) });
    } catch (err) {
      callback(grpcCallbackError(err, errors.DATABASE_OPERATION_FAILED));
    }
  }

  async create(call: GrpcRequest<QueryRequest>, callback: GrpcResponse<QueryResponse>) {
    const moduleName = call.metadata!.get('module-name')![0] as string;
    const schemaName = call.request.schemaName;
    try {
      const schemaAdapter = this._activeAdapter.getSchemaModel(schemaName);
      if (!(await canCreate(moduleName, schemaAdapter.model))) {
        return callback(
          grpcCallbackError({
            ...errors.MODULE_NOT_AUTHORIZED,
            message: `Module ${moduleName} is not authorized to create ${schemaName} entries!`,
          }),
        );
      }

      const doc = await schemaAdapter.model.create(call.request.query, {
        userId: call.request.userId,
        scope: call.request.scope,
      });
      const docString = JSON.stringify(doc);

      this.grpcSdk.bus?.publish(
        mutationEventChannel(this.name, 'create', schemaName),
        docString,
      );

      callback(null, { result: docString });
    } catch (err) {
      callback(grpcCallbackError(err, errors.DATABASE_OPERATION_FAILED));
    }
  }

  async createMany(
    call: GrpcRequest<QueryRequest>,
    callback: GrpcResponse<QueryResponse>,
  ) {
    const moduleName = call.metadata!.get('module-name')![0] as string;
    const schemaName = call.request.schemaName;
    try {
      const schemaAdapter = this._activeAdapter.getSchemaModel(schemaName);
      if (!(await canCreate(moduleName, schemaAdapter.model))) {
        return callback(
          grpcCallbackError({
            ...errors.MODULE_NOT_AUTHORIZED,
            message: `Module ${moduleName} is not authorized to create ${schemaName} entries!`,
          }),
        );
      }

      const docs = await schemaAdapter.model.createMany(call.request.query, {
        userId: call.request.userId,
        scope: call.request.scope,
      });
      const docsString = JSON.stringify(docs);

      this.grpcSdk.bus?.publish(
        mutationEventChannel(this.name, 'createMany', schemaName),
        docsString,
      );

      callback(null, { result: docsString });
    } catch (err) {
      callback(grpcCallbackError(err, errors.DATABASE_OPERATION_FAILED));
    }
  }

  async findByIdAndUpdate(
    call: GrpcRequest<UpdateRequest>,
    callback: GrpcResponse<QueryResponse>,
  ) {
    const moduleName = callerModuleName(call.metadata);
    const { schemaName } = call.request;
    try {
      const schemaAdapter = this._activeAdapter.getSchemaModel(schemaName);
      if (call.request.embeddingsJob) {
        assertEmbeddingsJobCaller(moduleName);
        assertEmbeddingsJobWrite({
          document: call.request.query,
          schema: schemaAdapter.model.originalSchema as ConduitDatabaseSchema,
        });
      } else if (
        !(await canModify(
          moduleName ?? '',
          schemaAdapter.model,
          JSON.parse(call.request.query),
        ))
      ) {
        return callback(
          grpcCallbackError({
            ...errors.MODULE_NOT_AUTHORIZED,
            message: `Module ${moduleName} is not authorized to modify ${schemaName} entries!`,
          }),
        );
      }

      const result = await schemaAdapter.model.findByIdAndUpdate(
        call.request.id,
        call.request.query,
        {
          populate: call.request.populate,
          userId: call.request.userId,
          scope: call.request.scope,
        },
      );
      const resultString = JSON.stringify(result);

      if (shouldPublishMutationEvent(call.request.suppressEvent)) {
        this.grpcSdk.bus?.publish(
          mutationEventChannel(this.name, 'update', schemaName),
          resultString,
        );
      }

      callback(null, { result: resultString });
    } catch (err) {
      callback(grpcCallbackError(err, errors.DATABASE_OPERATION_FAILED));
    }
  }

  async findByIdAndReplace(
    call: GrpcRequest<UpdateRequest>,
    callback: GrpcResponse<QueryResponse>,
  ) {
    const moduleName = call.metadata!.get('module-name')![0] as string;
    const { schemaName } = call.request;
    try {
      const schemaAdapter = this._activeAdapter.getSchemaModel(schemaName);
      if (!(await canModify(moduleName, schemaAdapter.model))) {
        return callback(
          grpcCallbackError({
            ...errors.MODULE_NOT_AUTHORIZED,
            message: `Module ${moduleName} is not authorized to modify ${schemaName} entries!`,
          }),
        );
      }

      const result = await schemaAdapter.model.findByIdAndReplace(
        call.request.id,
        call.request.query,
        {
          populate: call.request.populate,
          userId: call.request.userId,
          scope: call.request.scope,
        },
      );
      const resultString = JSON.stringify(result);

      if (shouldPublishMutationEvent(call.request.suppressEvent)) {
        this.grpcSdk.bus?.publish(
          mutationEventChannel(this.name, 'update', schemaName),
          resultString,
        );
      }

      callback(null, { result: resultString });
    } catch (err) {
      callback(grpcCallbackError(err, errors.DATABASE_OPERATION_FAILED));
    }
  }

  async replaceOne(
    call: GrpcRequest<UpdateManyRequest>,
    callback: GrpcResponse<QueryResponse>,
  ) {
    const moduleName = call.metadata!.get('module-name')![0] as string;
    const { schemaName } = call.request;
    try {
      const schemaAdapter = this._activeAdapter.getSchemaModel(schemaName);
      if (!(await canModify(moduleName, schemaAdapter.model))) {
        return callback(
          grpcCallbackError({
            ...errors.MODULE_NOT_AUTHORIZED,
            message: `Module ${moduleName} is not authorized to modify ${schemaName} entries!`,
          }),
        );
      }

      const result = await schemaAdapter.model.replaceOne(
        call.request.filterQuery,
        call.request.query,
        {
          populate: call.request.populate,
          userId: call.request.userId,
          scope: call.request.scope,
        },
      );
      const resultString = JSON.stringify(result);

      if (shouldPublishMutationEvent(call.request.suppressEvent)) {
        this.grpcSdk.bus?.publish(
          mutationEventChannel(this.name, 'update', schemaName),
          resultString,
        );
      }

      callback(null, { result: resultString });
    } catch (err) {
      callback(grpcCallbackError(err, errors.DATABASE_OPERATION_FAILED));
    }
  }

  async updateOne(
    call: GrpcRequest<UpdateManyRequest>,
    callback: GrpcResponse<QueryResponse>,
  ) {
    const moduleName = call.metadata!.get('module-name')![0] as string;
    const { schemaName } = call.request;
    try {
      const schemaAdapter = this._activeAdapter.getSchemaModel(schemaName);
      if (
        !(await canModify(
          moduleName,
          schemaAdapter.model,
          JSON.parse(call.request.query),
        ))
      ) {
        return callback(
          grpcCallbackError({
            ...errors.MODULE_NOT_AUTHORIZED,
            message: `Module ${moduleName} is not authorized to modify ${schemaName} entries!`,
          }),
        );
      }

      const result = await schemaAdapter.model.updateOne(
        call.request.filterQuery,
        call.request.query,
        {
          populate: call.request.populate,
          userId: call.request.userId,
          scope: call.request.scope,
        },
      );
      const resultString = JSON.stringify(result);

      if (shouldPublishMutationEvent(call.request.suppressEvent)) {
        this.grpcSdk.bus?.publish(
          mutationEventChannel(this.name, 'update', schemaName),
          resultString,
        );
      }

      callback(null, { result: resultString });
    } catch (err) {
      callback(grpcCallbackError(err, errors.DATABASE_OPERATION_FAILED));
    }
  }

  async updateMany(
    call: GrpcRequest<UpdateManyRequest>,
    callback: GrpcResponse<QueryResponse>,
  ) {
    const moduleName = call.metadata!.get('module-name')![0] as string;
    const { schemaName } = call.request;
    try {
      const schemaAdapter = this._activeAdapter.getSchemaModel(schemaName);
      if (
        !(await canModify(
          moduleName,
          schemaAdapter.model,
          JSON.parse(call.request.query),
        ))
      ) {
        return callback(
          grpcCallbackError({
            ...errors.MODULE_NOT_AUTHORIZED,
            message: `Module ${moduleName} is not authorized to modify ${schemaName} entries!`,
          }),
        );
      }

      const ids = shouldPublishMutationEvent(call.request.suppressEvent)
        ? await this.collectMutationIds(schemaAdapter.model, call.request.filterQuery, {
            userId: call.request.userId,
            scope: call.request.scope,
          })
        : [];
      const result = await schemaAdapter.model.updateMany(
        call.request.filterQuery,
        call.request.query,
        {
          populate: call.request.populate,
          userId: call.request.userId,
          scope: call.request.scope,
        },
      );
      const resultString = JSON.stringify(result);

      if (shouldPublishMutationEvent(call.request.suppressEvent)) {
        for (const payload of buildMutationEventChunks(ids)) {
          this.grpcSdk.bus?.publish(
            mutationEventChannel(this.name, 'updateMany', schemaName),
            payload,
          );
        }
      }

      callback(null, { result: resultString });
    } catch (err) {
      callback(grpcCallbackError(err, errors.DATABASE_OPERATION_FAILED));
    }
  }

  async deleteOne(
    call: GrpcRequest<QueryRequest>,
    callback: GrpcResponse<QueryResponse>,
  ) {
    const moduleName = call.metadata!.get('module-name')![0] as string;
    const { schemaName, query } = call.request;
    try {
      const schemaAdapter = this._activeAdapter.getSchemaModel(schemaName);
      if (!(await canDelete(moduleName, schemaAdapter.model))) {
        return callback(
          grpcCallbackError({
            ...errors.MODULE_NOT_AUTHORIZED,
            message: `Module ${moduleName} is not authorized to delete ${schemaName} entries!`,
          }),
        );
      }

      const result = await schemaAdapter.model.deleteOne(query, {
        userId: call.request.userId,
        scope: call.request.scope,
      });
      const resultString = JSON.stringify(result);

      this.grpcSdk.bus?.publish(
        mutationEventChannel(this.name, 'delete', schemaName),
        resultString,
      );

      callback(null, { result: resultString });
    } catch (err) {
      callback(grpcCallbackError(err, errors.DATABASE_OPERATION_FAILED));
    }
  }

  async deleteMany(
    call: GrpcRequest<QueryRequest>,
    callback: GrpcResponse<QueryResponse>,
  ) {
    const moduleName = call.metadata!.get('module-name')![0] as string;
    const { schemaName, query } = call.request;
    try {
      const schemaAdapter = this._activeAdapter.getSchemaModel(schemaName);
      if (!(await canDelete(moduleName, schemaAdapter.model))) {
        return callback(
          grpcCallbackError({
            ...errors.MODULE_NOT_AUTHORIZED,
            message: `Module ${moduleName} is not authorized to delete ${schemaName} entries!`,
          }),
        );
      }

      const result = await schemaAdapter.model.deleteMany(query, {
        userId: call.request.userId,
        scope: call.request.scope,
      });
      const resultString = JSON.stringify(result);

      this.grpcSdk.bus?.publish(
        mutationEventChannel(this.name, 'delete', schemaName),
        resultString,
      );

      callback(null, { result: resultString });
    } catch (err) {
      callback(grpcCallbackError(err, errors.DATABASE_OPERATION_FAILED));
    }
  }

  async countDocuments(
    call: GrpcRequest<QueryRequest>,
    callback: GrpcResponse<QueryResponse>,
  ) {
    try {
      const schemaAdapter = this._activeAdapter.getSchemaModel(call.request.schemaName);
      const result = await schemaAdapter.model.countDocuments(call.request.query, {
        userId: call.request.userId,
        scope: call.request.scope,
        readPreference: call.request.readPreference,
      });
      callback(null, { result: JSON.stringify(result) });
    } catch (err) {
      callback(grpcCallbackError(err, errors.DATABASE_OPERATION_FAILED));
    }
  }

  async rawQuery(
    call: GrpcRequest<RawQueryRequest>,
    callback: GrpcResponse<QueryResponse>,
  ) {
    const { schemaName, query } = call.request;
    const dbType = this._activeAdapter.getDatabaseType();
    if (
      (dbType === 'MongoDB' && isNil(query?.mongoQuery)) ||
      (dbType !== 'MongoDB' && isNil(query?.sqlQuery))
    ) {
      return callback(
        grpcCallbackError({
          ...errors.RAW_QUERY_INVALID,
          message: `Invalid raw query format for ${dbType}`,
        }),
      );
    }
    try {
      let result;
      if (dbType === 'MongoDB') {
        const processed: any = query!.mongoQuery!;
        for (const key of Object.keys(query!.mongoQuery!)) {
          if (key === 'operation' || key[0] === '_') {
            delete processed[key];
            continue;
          }
          processed[key] = JSON.parse(processed[key]);
        }
        result = await this._activeAdapter.execRawQuery(schemaName, processed);
      } else {
        let options;
        if (query!.sqlQuery!.options) {
          options = JSON.parse(query!.sqlQuery!.options);
        }
        result = await this._activeAdapter.execRawQuery(schemaName, {
          query: query!.sqlQuery!.query,
          options: options,
        });
      }
      callback(null, { result: JSON.stringify(result) });
    } catch (e) {
      callback(grpcCallbackError(e, errors.DATABASE_OPERATION_FAILED));
    }
  }

  async columnExistence(
    call: GrpcRequest<ColumnExistenceRequest>,
    callback: GrpcResponse<ColumnExistenceResponse>,
  ) {
    try {
      const schemaAdapter = this._activeAdapter.getSchemaModel(call.request.schemaName);
      const exist = await schemaAdapter.model.columnExistence(call.request.columns);
      callback(null, { result: exist });
    } catch (err) {
      callback(grpcCallbackError(err, errors.DATABASE_OPERATION_FAILED));
    }
  }

  async getVectorCapabilities(
    call: GrpcRequest<VectorCapabilitiesRequest>,
    callback: GrpcResponse<VectorCapabilitiesResponse>,
  ) {
    try {
      const result = await this._activeAdapter.getVectorCapabilities(
        call.request.schemaName,
      );
      callback(null, result);
    } catch (err) {
      callback(grpcCallbackError(err, errors.DATABASE_OPERATION_FAILED));
    }
  }

  async createVectorIndex(
    call: GrpcRequest<VectorIndexRequest>,
    callback: GrpcResponse<QueryResponse>,
  ) {
    try {
      if (!call.request.index) {
        return callback(
          grpcCallbackError({
            ...errors.VECTOR_INDEX_INVALID,
            message: 'Vector index definition is required',
          }),
        );
      }
      const moduleName = call.metadata!.get('module-name')![0] as string;
      const schemaAdapter = this._activeAdapter.getSchemaModel(call.request.schemaName);
      const index = this.parseVectorIndex(call.request.index);
      if (
        !(await canModify(
          moduleName,
          schemaAdapter.model,
          vectorIndexMutationData(index.field),
        ))
      ) {
        return callback(
          grpcCallbackError({
            ...errors.MODULE_NOT_AUTHORIZED,
            message: `Module ${moduleName} is not authorized to create vector indexes for ${call.request.schemaName}!`,
          }),
        );
      }
      const result = await this._activeAdapter.createVectorIndex(
        call.request.schemaName,
        index,
      );
      callback(null, { result: JSON.stringify(result) });
    } catch (err) {
      callback(grpcCallbackError(err, errors.DATABASE_OPERATION_FAILED));
    }
  }

  async getVectorIndexes(
    call: GrpcRequest<VectorIndexListRequest>,
    callback: GrpcResponse<VectorIndexListResponse>,
  ) {
    try {
      const indexes = await this._activeAdapter.getVectorIndexes(call.request.schemaName);
      callback(null, {
        indexes: indexes.map(index => ({
          field: index.field,
          dimensions: index.dimensions,
          similarity: index.similarity,
          name: index.name,
          method: defaultVectorIndexMethod(index.method),
          filterFields: [...(index.filterFields ?? [])],
          options: index.options ? JSON.stringify(index.options) : undefined,
          status: index.status,
          queryable: index.queryable,
        })),
      });
    } catch (err) {
      callback(grpcCallbackError(err, errors.DATABASE_OPERATION_FAILED));
    }
  }

  async deleteVectorIndex(
    call: GrpcRequest<DeleteVectorIndexRequest>,
    callback: GrpcResponse<QueryResponse>,
  ) {
    try {
      const moduleName = call.metadata!.get('module-name')![0] as string;
      const schemaAdapter = this._activeAdapter.getSchemaModel(call.request.schemaName);
      const liveIndexes = await this._activeAdapter.getVectorIndexes(
        call.request.schemaName,
      );
      if (
        !(await canModify(
          moduleName,
          schemaAdapter.model,
          vectorIndexDeleteMutationData(liveIndexes, call.request.indexName),
        ))
      ) {
        return callback(
          grpcCallbackError({
            ...errors.MODULE_NOT_AUTHORIZED,
            message: `Module ${moduleName} is not authorized to delete vector indexes for ${call.request.schemaName}!`,
          }),
        );
      }
      const result = await this._activeAdapter.deleteVectorIndex(
        call.request.schemaName,
        call.request.indexName,
      );
      callback(null, { result: JSON.stringify(result) });
    } catch (err) {
      callback(grpcCallbackError(err, errors.DATABASE_OPERATION_FAILED));
    }
  }

  async vectorSearch(
    call: GrpcRequest<VectorSearchRequest>,
    callback: GrpcResponse<QueryResponse>,
  ) {
    try {
      const schemaAdapter = this._activeAdapter.getSchemaModel(call.request.schemaName);
      const adminOperator = resolveAdminOperatorContext({
        requested: call.request.adminOperator,
        callerModule: callerModuleName(call.metadata),
      });
      assertVectorSearchAccess({
        authzEnabled: !!schemaAdapter.model.authzEnabled,
        userId: call.request.userId,
        scope: call.request.scope,
        adminOperator,
      });
      const result = await this._activeAdapter.vectorSearch({
        schemaName: call.request.schemaName,
        field: call.request.field,
        vector: call.request.vector,
        indexName: call.request.indexName,
        filter: call.request.filter ? JSON.parse(call.request.filter) : undefined,
        limit: call.request.limit,
        numCandidates: call.request.numCandidates,
        select: call.request.select,
        userId: call.request.userId,
        scope: call.request.scope,
        adminOperator,
      });
      callback(null, { result: JSON.stringify(result) });
    } catch (err) {
      callback(grpcCallbackError(err, errors.DATABASE_OPERATION_FAILED));
    }
  }

  async migrate(call: GrpcRequest<MigrateRequest>, callback: GrpcResponse<Empty>) {
    try {
      if (this._activeAdapter.getDatabaseType() !== 'MongoDB') {
        const schemaName = call.request.schemaName;
        await this._activeAdapter.syncSchema(schemaName).catch(async () => {
          const views: IView[] = await this._activeAdapter
            .getSchemaModel('Views')
            .model.findMany({});
          for (const view of views) {
            if (view.joinedSchemas.includes(schemaName)) {
              await this._activeAdapter.deleteView(view.name);
            }
          }
          await this._activeAdapter.syncSchema(schemaName);
        });
      }
      callback(null, {});
    } catch (err) {
      callback(grpcCallbackError(err, errors.SCHEMA_OPERATION_FAILED));
    }
  }

  async getDatabaseType(
    call: GrpcRequest<Empty>,
    callback: GrpcResponse<GetDatabaseTypeResponse>,
  ) {
    const result = this._activeAdapter.getDatabaseType();
    callback(null, { result });
  }

  async generateId(
    call: GrpcRequest<Empty>,
    callback: GrpcResponse<GetDatabaseTypeResponse>,
  ) {
    const result = this._activeAdapter.generateId();
    callback(null, { result });
  }

  private parseVectorIndex(index: VectorIndex): VectorIndexDefinition {
    return {
      field: index.field,
      dimensions: index.dimensions,
      similarity: index.similarity as VectorSimilarity,
      name: index.name,
      method: defaultVectorIndexMethod(index.method),
      filterFields: index.filterFields,
      options: index.options ? JSON.parse(index.options) : undefined,
    };
  }

  private registerInstanceSyncEvents() {
    this.grpcSdk.bus?.subscribe('database:request:schemas', () => {
      this._activeAdapter.registeredSchemas.forEach(schema => {
        this._activeAdapter.publishSchema(schema as ConduitDatabaseSchema); // @dirty-type-cast
      });
    });
    try {
      this.grpcSdk.bus?.subscribe('database:create:schema', async schemaStr => {
        try {
          const syncSchema: ConduitDatabaseSchema = JSON.parse(schemaStr); // @dirty-type-cast
          delete (syncSchema as any).fieldHash;
          await this._activeAdapter.createSchemaFromAdapter(
            syncSchema,
            false,
            false,
            true,
          );
        } catch (e) {
          ConduitGrpcSdk.Logger.error(
            `Failed to synchronize created schema: ${parseErrorPayload(e).message}`,
          );
        }
      });
      this.grpcSdk.bus?.subscribe('database:create:view', async viewStr => {
        try {
          const viewData = JSON.parse(viewStr);
          await this._activeAdapter.createViewFromAdapter(viewData, true);
        } catch (e) {
          ConduitGrpcSdk.Logger.error(
            `Failed to synchronize created view: ${parseErrorPayload(e).message}`,
          );
        }
      });
      this.grpcSdk.bus?.subscribe('database:delete:schema', async schemaName => {
        try {
          await this._activeAdapter.deleteSchema(schemaName, false, '', true);
        } catch (e) {
          ConduitGrpcSdk.Logger.error(
            `Failed to synchronize deleted schema: ${parseErrorPayload(e).message}`,
          );
        }
      });
      this.grpcSdk.bus?.subscribe('database:delete:view', async (viewName: string) => {
        delete this._activeAdapter.views[viewName];
        if (this._activeAdapter instanceof MongooseAdapter) {
          delete this._activeAdapter.mongoose.models[viewName];
        }
      });
    } catch {
      ConduitGrpcSdk.Logger.error('Failed to synchronize schema');
    }
  }

  private onCoreHealthChange(state: HealthCheckStatus) {
    const boundFunctionRef = this.onCoreHealthChange.bind(this);
    if (state === HealthCheckStatus.SERVING) {
      this.schemaController = new SchemaController(this.grpcSdk, this._activeAdapter);
      this.customEndpointController = new CustomEndpointController(
        this.grpcSdk,
        this._activeAdapter,
      );
      this.realtimeService = new RealtimeService(this.grpcSdk, this._activeAdapter);
      this.adminRouter = new AdminHandlers(
        this.grpcServer,
        this.grpcSdk,
        this._activeAdapter,
        this.schemaController,
        this.customEndpointController,
        this.realtimeService,
      );
      void this.realtimeService.reconcile();
      this._databaseRouterWatchDispose?.();
      this._databaseRouterWatchDispose = this.grpcSdk.watchPeer(
        'router',
        serving => {
          if (!serving || this.userRouter) return;
          this.userRouter = new DatabaseRoutes(
            this.grpcServer,
            this._activeAdapter,
            this.grpcSdk,
            this.realtimeService,
          );
          this.schemaController?.setRouter(this.userRouter);
          this.customEndpointController?.setRouter(this.userRouter);
        },
        { edge: 'rising', syncInitialState: true },
      );
    } else {
      this._databaseRouterWatchDispose?.();
      this._databaseRouterWatchDispose = null;
      this.grpcSdk.core.healthCheckWatcher.once(
        'grpc-health-change:Core',
        boundFunctionRef,
      );
    }
  }

  async shutdown(): Promise<void> {
    await this.realtimeService?.shutdown();
  }

  private async collectMutationIds(
    model: MongooseSchema | SequelizeSchema,
    filterQuery: string,
    options: { userId?: string; scope?: string },
  ): Promise<string[]> {
    return collectBoundedMutationIds({
      findPage: (skip, limit) =>
        model.findMany(filterQuery, {
          select: '_id',
          skip,
          limit,
          sort: { _id: 1 },
          userId: options.userId,
          scope: options.scope,
        }),
    });
  }
}
