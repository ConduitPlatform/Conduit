import ConduitGrpcSdk, {
  ConduitSchema,
  GrpcError,
  HealthCheckStatus,
  ManagedModule,
  GrpcRequest,
  GrpcResponse,
  ConduitModel,
} from '@conduitplatform/grpc-sdk';
import { AdminHandlers } from './admin';
import { DatabaseRoutes } from './routes';
import * as models from './models';
import {
  Schema as SchemaDto,
  DropCollectionRequest,
  DropCollectionResponse,
  FindOneRequest,
  FindRequest,
  GetSchemaRequest,
  GetSchemasRequest,
  QueryRequest,
  QueryResponse,
  UpdateManyRequest,
  UpdateRequest,
  RawQueryRequest,
} from './protoTypes/database';
import { CreateSchemaExtensionRequest, SchemaResponse, SchemasResponse } from './types';
import { DatabaseAdapter } from './adapters/DatabaseAdapter';
import { MongooseAdapter } from './adapters/mongoose-adapter';
import { SequelizeAdapter } from './adapters/sequelize-adapter';
import { MongooseSchema } from './adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from './adapters/sequelize-adapter/SequelizeSchema';
import { Schema, ConduitDatabaseSchema } from './interfaces';
import { canCreate, canDelete, canModify } from './permissions';
import { runMigrations } from './migrations';
import { SchemaController } from './controllers/cms/schema.controller';
import { CustomEndpointController } from './controllers/customEndpoints/customEndpoint.controller';
import { SchemaConverter } from './utils/SchemaConverter';
import { status } from '@grpc/grpc-js';
import path from 'path';
import metricsSchema from './metrics';
import { isNil } from 'lodash';

export default class DatabaseModule extends ManagedModule<void> {
  configSchema = undefined;
  protected metricsSchema = metricsSchema;
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
      findByIdAndUpdate: this.findByIdAndUpdate.bind(this),
      updateMany: this.updateMany.bind(this),
      deleteOne: this.deleteOne.bind(this),
      deleteMany: this.deleteMany.bind(this),
      countDocuments: this.countDocuments.bind(this),
      rawQuery: this.rawQuery.bind(this),
    },
  };
  private adminRouter?: AdminHandlers;
  private userRouter?: DatabaseRoutes;
  private readonly _activeAdapter: DatabaseAdapter<MongooseSchema | SequelizeSchema>;

  constructor(dbType: string, dbUri: string) {
    super('database');
    this.updateHealth(HealthCheckStatus.UNKNOWN, true);
    if (dbType === 'mongodb') {
      this._activeAdapter = new MongooseAdapter(dbUri);
    } else if (dbType === 'postgres' || dbType === 'sql') {
      // Compat (<=0.12.2): sql
      this._activeAdapter = new SequelizeAdapter(dbUri);
    } else {
      throw new Error('Database type not supported');
    }
  }

  async preServerStart() {
    await this._activeAdapter.init(this.grpcSdk);
    await this.registerMetrics();
  }

  async onServerStart() {
    await this._activeAdapter.registerSystemSchema(models.DeclaredSchema);
    const modelPromises = Object.values(models).flatMap((model: ConduitSchema) => {
      if (model.name === '_DeclaredSchema') return [];
      return this._activeAdapter.registerSystemSchema(model);
    });
    await Promise.all(modelPromises);
    await this._activeAdapter.retrieveForeignSchemas();
    await this._activeAdapter.recoverSchemasFromDatabase();
    await runMigrations(this._activeAdapter);
    this.updateHealth(HealthCheckStatus.SERVING);
  }

  async onRegister() {
    this.registerInstanceSyncEvents();
    const coreHealth = (await this.grpcSdk.core.check()) as unknown as HealthCheckStatus;
    this.onCoreHealthChange(coreHealth);
    await this.grpcSdk.core.watch('');
  }

  private registerInstanceSyncEvents() {
    this.grpcSdk.bus?.subscribe('database:request:schemas', () => {
      this._activeAdapter.registeredSchemas.forEach(schema => {
        this._activeAdapter.publishSchema(schema as ConduitDatabaseSchema); // @dirty-type-cast
      });
    });
    try {
      this.grpcSdk.bus?.subscribe('database:create:schema', async schemaStr => {
        const syncSchema: ConduitDatabaseSchema = JSON.parse(schemaStr); // @dirty-type-cast
        delete (syncSchema as any).fieldHash;
        await this._activeAdapter.createSchemaFromAdapter(syncSchema, false, false, true);
      });
      this.grpcSdk.bus?.subscribe('database:delete:schema', async schemaName => {
        await this._activeAdapter.deleteSchema(schemaName, false, '', true);
      });
    } catch {
      ConduitGrpcSdk.Logger.error('Failed to synchronize schema');
    }
  }

  private onCoreHealthChange(state: HealthCheckStatus) {
    const boundFunctionRef = this.onCoreHealthChange.bind(this);
    if (state === HealthCheckStatus.SERVING) {
      const schemaController = new SchemaController(this.grpcSdk, this._activeAdapter);
      const customEndpointController = new CustomEndpointController(
        this.grpcSdk,
        this._activeAdapter,
      );
      this.adminRouter = new AdminHandlers(
        this.grpcServer,
        this.grpcSdk,
        this._activeAdapter,
        schemaController,
        customEndpointController,
      );
      this.grpcSdk
        .waitForExistence('router')
        .then(() => {
          this.userRouter = new DatabaseRoutes(
            this.grpcServer,
            this._activeAdapter,
            this.grpcSdk,
          );
          schemaController.setRouter(this.userRouter);
          customEndpointController.setRouter(this.userRouter);
        })
        .catch(e => {
          ConduitGrpcSdk.Logger.error(e.message);
        });
    } else {
      this.grpcSdk.core.healthCheckWatcher.once(
        'grpc-health-change:Core',
        boundFunctionRef,
      );
    }
  }

  async initializeMetrics() {
    const customEndpointsTotal = await this._activeAdapter
      .getSchemaModel('CustomEndpoints')
      .model.countDocuments({});
    ConduitGrpcSdk.Metrics?.set('custom_endpoints_total', customEndpointsTotal);
  }

  // gRPC Service
  /**
   * Should accept a JSON schema and output a .ts interface for the adapter
   * @param call
   * @param callback
   */
  async createSchemaFromAdapter(call: GrpcRequest<SchemaDto>, callback: SchemaResponse) {
    const schema = new ConduitSchema(
      call.request.name,
      JSON.parse(call.request.fields),
      JSON.parse(call.request.modelOptions),
      call.request.collectionName,
    );
    if (schema.name.indexOf('-') >= 0 || schema.name.indexOf(' ') >= 0) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Names cannot include spaces and - characters',
      });
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
        callback({
          code: status.INTERNAL,
          message: err.message,
        });
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
      callback({
        code: status.INTERNAL,
        message: (err as Error).message,
      });
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
      callback({
        code: status.INTERNAL,
        message: (err as Error).message,
      });
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
      callback({
        code: status.INTERNAL,
        message: (err as Error).message,
      });
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
        throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
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
          callback({
            code: status.INTERNAL,
            message: err.message,
          });
        });
    } catch (err) {
      callback({
        code: status.INTERNAL,
        message: (err as Error).message,
      });
    }
  }

  async findOne(
    call: GrpcRequest<FindOneRequest>,
    callback: GrpcResponse<QueryResponse>,
  ) {
    try {
      const schemaAdapter = this._activeAdapter.getSchemaModel(call.request.schemaName);
      const doc = await schemaAdapter.model.findOne(
        call.request.query,
        call.request.select,
        call.request.populate,
      );
      callback(null, { result: JSON.stringify(doc) });
    } catch (err) {
      callback({
        code: status.INTERNAL,
        message: (err as Error).message,
      });
    }
  }

  async findMany(call: GrpcRequest<FindRequest>, callback: GrpcResponse<QueryResponse>) {
    try {
      const { skip, limit, select, populate } = call.request;
      const sort = call.request.sort as { [key: string]: -1 | 1 | number } | undefined;
      if (sort) {
        Object.keys(sort).forEach(field => {
          if (sort[field] !== 1 && sort[field] !== -1) {
            return callback({
              code: status.INVALID_ARGUMENT,
              message: `Invalid sort field value "${sort[field]}" in field "${field}", should be -1 or 1.`,
            });
          }
        });
      }
      const schemaAdapter = this._activeAdapter.getSchemaModel(call.request.schemaName);
      const docs = await schemaAdapter.model.findMany(
        call.request.query,
        skip,
        limit,
        select,
        sort as { [key: string]: -1 | 1 } | undefined,
        populate,
      );
      callback(null, { result: JSON.stringify(docs) });
    } catch (err) {
      callback({
        code: status.INTERNAL,
        message: (err as Error).message,
      });
    }
  }

  async create(call: GrpcRequest<QueryRequest>, callback: GrpcResponse<QueryResponse>) {
    const moduleName = call.metadata!.get('module-name')![0] as string;
    const schemaName = call.request.schemaName;
    try {
      const schemaAdapter = this._activeAdapter.getSchemaModel(schemaName);
      if (!(await canCreate(moduleName, schemaAdapter.model))) {
        return callback({
          code: status.PERMISSION_DENIED,
          message: `Module ${moduleName} is not authorized to create ${schemaName} entries!`,
        });
      }

      const doc = await schemaAdapter.model.create(call.request.query);
      const docString = JSON.stringify(doc);

      this.grpcSdk.bus?.publish(`${this.name}:create:${schemaName}`, docString);

      callback(null, { result: docString });
    } catch (err) {
      callback({
        code: status.INTERNAL,
        message: (err as Error).message,
      });
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
        return callback({
          code: status.PERMISSION_DENIED,
          message: `Module ${moduleName} is not authorized to create ${schemaName} entries!`,
        });
      }

      const docs = await schemaAdapter.model.createMany(call.request.query);
      const docsString = JSON.stringify(docs);

      this.grpcSdk.bus?.publish(`${this.name}:createMany:${schemaName}`, docsString);

      callback(null, { result: docsString });
    } catch (err) {
      callback({
        code: status.INTERNAL,
        message: (err as Error).message,
      });
    }
  }

  async findByIdAndUpdate(
    call: GrpcRequest<UpdateRequest>,
    callback: GrpcResponse<QueryResponse>,
  ) {
    const moduleName = call.metadata!.get('module-name')![0] as string;
    const { schemaName } = call.request;
    try {
      const schemaAdapter = this._activeAdapter.getSchemaModel(schemaName);
      if (!(await canModify(moduleName, schemaAdapter.model))) {
        return callback({
          code: status.PERMISSION_DENIED,
          message: `Module ${moduleName} is not authorized to modify ${schemaName} entries!`,
        });
      }

      const result = await schemaAdapter.model.findByIdAndUpdate(
        call.request.id,
        call.request.query,
        call.request.populate,
      );
      const resultString = JSON.stringify(result);

      this.grpcSdk.bus?.publish(`${this.name}:update:${schemaName}`, resultString);

      callback(null, { result: resultString });
    } catch (err) {
      callback({
        code: status.INTERNAL,
        message: (err as Error).message,
      });
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
      if (!(await canModify(moduleName, schemaAdapter.model))) {
        return callback({
          code: status.PERMISSION_DENIED,
          message: `Module ${moduleName} is not authorized to modify ${schemaName} entries!`,
        });
      }

      const result = await schemaAdapter.model.updateMany(
        call.request.filterQuery,
        call.request.query,
        call.request.populate,
      );
      const resultString = JSON.stringify(result);

      this.grpcSdk.bus?.publish(`${this.name}:updateMany:${schemaName}`, resultString);

      callback(null, { result: resultString });
    } catch (err) {
      callback({
        code: status.INTERNAL,
        message: (err as Error).message,
      });
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
        return callback({
          code: status.PERMISSION_DENIED,
          message: `Module ${moduleName} is not authorized to delete ${schemaName} entries!`,
        });
      }

      const result = await schemaAdapter.model.deleteOne(query);
      const resultString = JSON.stringify(result);

      this.grpcSdk.bus?.publish(`${this.name}:delete:${schemaName}`, resultString);

      callback(null, { result: resultString });
    } catch (err) {
      callback({
        code: status.INTERNAL,
        message: (err as Error).message,
      });
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
        return callback({
          code: status.PERMISSION_DENIED,
          message: `Module ${moduleName} is not authorized to delete ${schemaName} entries!`,
        });
      }

      const result = await schemaAdapter.model.deleteMany(query);
      const resultString = JSON.stringify(result);

      this.grpcSdk.bus?.publish(`${this.name}:delete:${schemaName}`, resultString);

      callback(null, { result: resultString });
    } catch (err) {
      callback({
        code: status.INTERNAL,
        message: (err as Error).message,
      });
    }
  }

  async countDocuments(
    call: GrpcRequest<QueryRequest>,
    callback: GrpcResponse<QueryResponse>,
  ) {
    try {
      const schemaAdapter = this._activeAdapter.getSchemaModel(call.request.schemaName);
      const result = await schemaAdapter.model.countDocuments(call.request.query);
      callback(null, { result: JSON.stringify(result) });
    } catch (err) {
      callback({
        code: status.INTERNAL,
        message: (err as Error).message,
      });
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
      callback({
        code: status.INVALID_ARGUMENT,
        message: `Invalid raw query format for ${dbType}`,
      });
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
      callback({ code: status.INTERNAL, message: (e as Error).message });
    }
  }
}
