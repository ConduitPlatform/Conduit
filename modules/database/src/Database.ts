import ConduitGrpcSdk, {
  ConduitSchema,
  GrpcError,
  GrpcRequest,
  GrpcResponse,
  HealthCheckStatus,
  ManagedModule,
} from '@conduitplatform/grpc-sdk';
import { AdminHandlers } from './admin';
import { DatabaseRoutes } from './routes';
import * as models from './models';
import {
  CreateSchemaRequest,
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
} from './protoTypes/database';
import { CreateSchemaExtensionRequest, SchemaResponse, SchemasResponse } from './types';
import { DatabaseAdapter } from './adapters/DatabaseAdapter';
import { MongooseAdapter } from './adapters/mongoose-adapter';
import { SequelizeAdapter } from './adapters/sequelize-adapter';
import { MongooseSchema } from './adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from './adapters/sequelize-adapter/SequelizeSchema';
import { Schema } from './interfaces';
import { canCreate, canDelete, canModify } from './permissions';
import { runMigrations } from './migrations';
import { SchemaController } from './controllers/cms/schema.controller';
import { CustomEndpointController } from './controllers/customEndpoints/customEndpoint.controller';
import { status } from '@grpc/grpc-js';
import path from 'path';
import metricsConfig from './metrics';

export default class DatabaseModule extends ManagedModule<void> {
  configSchema = undefined;
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
    this._activeAdapter.connect();
    await this._activeAdapter.ensureConnected();
  }

  async onServerStart() {
    const declaredSchemaExists = await this._activeAdapter.checkDeclaredSchemaExistence();
    await this._activeAdapter.createSchemaFromAdapter(
      models.DeclaredSchema,
      false,
      !declaredSchemaExists,
    );
    await this._activeAdapter.retrieveForeignSchemas();
    this.updateHealth(HealthCheckStatus.SERVING);
    const modelPromises = Object.values(models).flatMap((model: ConduitSchema) => {
      if (model.name === '_DeclaredSchema') return [];
      return this._activeAdapter.createSchemaFromAdapter(model, false, true);
    });

    await Promise.all(modelPromises);
    await runMigrations(this._activeAdapter);

    await this._activeAdapter.recoverSchemasFromDatabase();
  }

  async onRegister() {
    const self = this;
    self.grpcSdk.bus?.subscribe('database', (message: string) => {
      if (message === 'request') {
        self._activeAdapter.registeredSchemas.forEach(k => {
          this.grpcSdk.bus!.publish('database', JSON.stringify(k));
        });
        return;
      }
      try {
        const receivedSchema = JSON.parse(message);
        if (receivedSchema.name) {
          const schema = new ConduitSchema(
            receivedSchema.name,
            receivedSchema.modelSchema,
            receivedSchema.modelOptions,
            receivedSchema.collectionName,
          );
          schema.ownerModule = receivedSchema.ownerModule;
          self._activeAdapter.createSchemaFromAdapter(schema).catch(() => {
            ConduitGrpcSdk.Logger.error('Failed to create/update schema');
          });
        }
      } catch (err) {
        ConduitGrpcSdk.Logger.error('Something was wrong with the message');
      }
    });
    const coreHealth = (await this.grpcSdk.core.check()) as unknown as HealthCheckStatus;
    this.onCoreHealthChange(coreHealth);
    await this.grpcSdk.core.watch('');
  }

  initializeMetrics() {
    for (const metric of Object.values(metricsConfig)) {
      this.grpcSdk.registerMetric(metric.type, metric.config);
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

  publishSchema(schema: any) {
    const sendingSchema = JSON.stringify(schema);
    this.grpcSdk.bus!.publish('database', sendingSchema);
    ConduitGrpcSdk.Logger.log('Updated state');
  }

  // gRPC Service
  /**
   * Should accept a JSON schema and output a .ts interface for the adapter
   * @param call
   * @param callback
   */
  async createSchemaFromAdapter(
    call: GrpcRequest<CreateSchemaRequest>,
    callback: SchemaResponse,
  ) {
    const schema = new ConduitSchema(
      call.request.schema!.name,
      JSON.parse(call.request.schema!.modelSchema),
      JSON.parse(call.request.schema!.modelOptions),
      call.request.schema!.collectionName,
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
        const originalSchema = {
          name: schemaAdapter.originalSchema.name,
          modelSchema: JSON.stringify(schemaAdapter.originalSchema.modelSchema),
          modelOptions: JSON.stringify(schemaAdapter.originalSchema.schemaOptions),
          collectionName: schemaAdapter.originalSchema.collectionName,
        };
        this.publishSchema({
          name: call.request.schema!.name,
          modelSchema: JSON.parse(call.request.schema!.modelSchema),
          modelOptions: JSON.parse(call.request.schema!.modelOptions),
          collectionName: call.request.schema!.collectionName,
          owner: schema.ownerModule,
        });
        callback(null, {
          schema: originalSchema,
        });
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
      callback(null, {
        schema: {
          name: schemaAdapter.name,
          modelSchema: JSON.stringify(schemaAdapter.modelSchema),
          modelOptions: JSON.stringify(schemaAdapter.schemaOptions),
          collectionName: schemaAdapter.collectionName,
        },
      });
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
        schemas: schemas.map(schema => {
          return {
            name: schema.name,
            modelSchema: JSON.stringify(schema.modelSchema),
            modelOptions: JSON.stringify(schema.schemaOptions),
            collectionName: schema.collectionName,
          };
        }),
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
      const schemaName = call.request.extension.name;
      const extOwner = call.metadata!.get('module-name')![0] as string;
      const extModel = JSON.parse(call.request.extension.modelSchema);
      const schema = await this._activeAdapter.getBaseSchema(schemaName);
      if (!schema) {
        throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
      }
      await this._activeAdapter
        .setSchemaExtension(schema, extOwner, extModel)
        .then((schemaAdapter: Schema) => {
          const originalSchema = {
            name: schemaAdapter.originalSchema.name,
            modelSchema: JSON.stringify(schemaAdapter.originalSchema.modelSchema),
            modelOptions: JSON.stringify(schemaAdapter.originalSchema.schemaOptions),
            collectionName: schemaAdapter.originalSchema.collectionName,
          };
          this.publishSchema({
            name: call.request.extension.name,
            modelSchema: schemaAdapter.model,
            modelOptions: schemaAdapter.originalSchema.schemaOptions,
            collectionName: schemaAdapter.originalSchema.collectionName,
            owner: schemaAdapter.originalSchema.ownerModule,
          });
          callback(null, {
            schema: originalSchema,
          });
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
        schemaAdapter.relations,
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
      const skip = call.request.skip;
      const limit = call.request.limit;
      const select = call.request.select;
      const sort = call.request.sort ? JSON.parse(call.request.sort) : null;
      const populate = call.request.populate;

      const schemaAdapter = this._activeAdapter.getSchemaModel(call.request.schemaName);

      const docs = await schemaAdapter.model.findMany(
        call.request.query,
        skip,
        limit,
        select,
        sort,
        populate,
        schemaAdapter.relations,
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
        call.request.updateProvidedOnly,
        call.request.populate,
        schemaAdapter.relations,
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
        call.request.updateProvidedOnly,
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
}
