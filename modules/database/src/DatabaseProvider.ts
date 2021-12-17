import { MongooseAdapter } from './adapters/mongoose-adapter';
import { SequelizeAdapter } from './adapters/sequelize-adapter';
import { SchemaAdapter } from './interfaces';
import ConduitGrpcSdk, {
  ConduitSchema,
  ConduitServiceModule,
  GrpcServer,
} from '@quintessential-sft/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import path from 'path';
import {
  CreateSchemaRequest,
  FindOneRequest,
  FindRequest,
  GetSchemaRequest,
  GetSchemasRequest,
  QueryRequest,
  QueryResponse,
  SchemaResponse,
  SchemasResponse,
  UpdateManyRequest,
  UpdateRequest,
  DropCollectionResponse,
  DropCollectionRequest,
} from './types';
import * as models from './models';
import { MongooseSchema } from './adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from './adapters/sequelize-adapter/SequelizeSchema';
import { DatabaseAdapter } from './adapters/DatabaseAdapter';
import { AdminHandlers } from './admin/admin';

const MODULE_NAME = 'database';

export class DatabaseProvider extends ConduitServiceModule {
  private readonly _activeAdapter: DatabaseAdapter<MongooseSchema | SequelizeSchema>;
  private _admin: AdminHandlers;

  constructor(protected readonly grpcSdk: ConduitGrpcSdk) {
    super(grpcSdk)
    const dbType = process.env.databaseType ?? 'mongodb';
    const databaseUrl = process.env.databaseURL ?? 'mongodb://localhost:27017';

    if (dbType === 'mongodb') {
      this._activeAdapter = new MongooseAdapter(databaseUrl);
    } else if (dbType === 'sql') {
      this._activeAdapter = new SequelizeAdapter(databaseUrl);
    } else {
      throw new Error('Arguments not supported');
    }
  }

  publishSchema(schema: any) {
    let sendingSchema = JSON.stringify(schema);
    this.grpcSdk.bus!.publish('database', sendingSchema);
    console.log('Updated state');
  }

  async initialize(servicePort?: string) {
    await this._activeAdapter.ensureConnected();
    this.grpcServer = new GrpcServer(servicePort);
    this._port = (await this.grpcServer.createNewServer()).toString();
    await this.grpcServer.addService(
      path.resolve(__dirname, './database-provider.proto'),
      'databaseprovider.DatabaseProvider',
      {
        createSchemaFromAdapter: this.createSchemaFromAdapter.bind(this),
        getSchema: this.getSchema.bind(this),
        getSchemas: this.getSchemas.bind(this),
        deleteSchema: this.deleteSchema.bind(this),
        findOne: this.findOne.bind(this),
        findMany: this.findMany.bind(this),
        create: this.create.bind(this),
        createMany: this.createMany.bind(this),
        findByIdAndUpdate: this.findByIdAndUpdate.bind(this),
        updateMany: this.updateMany.bind(this),
        deleteOne: this.deleteOne.bind(this),
        deleteMany: this.deleteMany.bind(this),
        countDocuments: this.countDocuments.bind(this),
      }
    );
    await this.grpcServer.start();
  }

  async activate() {
    const self = this;
    await this.grpcSdk.initializeEventBus();
    self.grpcSdk.bus?.subscribe('database', (message: string) => {
      if (message === 'request') {
        self._activeAdapter.registeredSchemas.forEach((k) => {
          this.grpcSdk.bus!.publish('database', JSON.stringify(k));
        });
        return;
      }
      try {
        let receivedSchema = JSON.parse(message);
        if (receivedSchema.name) {
          let schema = new ConduitSchema(
            receivedSchema.name,
            receivedSchema.modelSchema,
            receivedSchema.modelOptions,
            receivedSchema.collectionName
          );
          schema.owner = receivedSchema.owner;
          self._activeAdapter
            .createSchemaFromAdapter(schema)
            .then(() => {})
            .catch(() => {
              console.log('Failed to create/update schema');
            });
        }
      } catch (err) {
        console.error('Something was wrong with the message');
      }
    });
    await this._activeAdapter.createSchemaFromAdapter(models._DeclaredSchema.getInstance((this.grpcSdk.databaseProvider!)));
    await this._activeAdapter.recoverSchemasFromDatabase();
    this._admin = new AdminHandlers(this.grpcServer, this.grpcSdk);
  }

  /**
   * Should accept a JSON schema and output a .ts interface for the adapter
   * @param call
   * @param callback
   */
  async createSchemaFromAdapter(call: CreateSchemaRequest, callback: SchemaResponse) {
    let schema = new ConduitSchema(
      call.request.schema.name,
      JSON.parse(call.request.schema.modelSchema),
      JSON.parse(call.request.schema.modelOptions),
      call.request.schema.collectionName
    );
    if (schema.name.indexOf('-') >= 0 || schema.name.indexOf(' ') >= 0) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Names cannot include spaces and - characters',
      });
    }
    schema.owner = (call as any).metadata.get('module-name')[0];
    await this._activeAdapter.createSchemaFromAdapter(schema)
    .then((schemaAdapter: SchemaAdapter<any>) => {
      let originalSchema = {
        name: schemaAdapter.originalSchema.name,
        modelSchema: JSON.stringify(schemaAdapter.originalSchema.modelSchema),
        modelOptions: JSON.stringify(schemaAdapter.originalSchema.schemaOptions),
        collectionName: schemaAdapter.originalSchema.collectionName,
      };
      this.publishSchema({
        name: call.request.schema.name,
        modelSchema: JSON.parse(call.request.schema.modelSchema),
        modelOptions: JSON.parse(call.request.schema.modelOptions),
        collectionName: call.request.schema.collectionName,
        owner: schema.owner,
      });
      callback(null, {
        schema: originalSchema,
      });
    })
    .catch((err: any) => {
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
  getSchema(call: GetSchemaRequest, callback: SchemaResponse) {
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
        message: err.message,
      });
    }
  }

  getSchemas(call: GetSchemasRequest, callback: SchemasResponse) {
    try {
      const schemas = this._activeAdapter.getSchemas();
      callback(null, {
        schemas: schemas.map((schema) => {
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
        message: err.message,
      });
    }
  }

  async deleteSchema(call: DropCollectionRequest, callback: DropCollectionResponse) {
    try {
      const schemas = await  this._activeAdapter.deleteSchema(call.request.schemaName,call.request.deleteData);
      callback(null, { result: schemas });
    } catch (err) {
      callback({
        code: status.INTERNAL,
        message: err.message,
      });
    }
  }

  async findOne(call: FindOneRequest, callback: QueryResponse) {
    try {
      const schemaAdapter = this._activeAdapter.getSchemaModel(call.request.schemaName);
      const doc = await schemaAdapter.model.findOne(
        call.request.query,
        call.request.select,
        call.request.populate,
        schemaAdapter.relations
      );
      callback(null, { result: JSON.stringify(doc) });
    } catch (err) {
      callback({
        code: status.INTERNAL,
        message: err.message,
      });
    }
  }

  async findMany(call: FindRequest, callback: QueryResponse) {
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
        schemaAdapter.relations
      );
      callback(null, { result: JSON.stringify(docs) });
    } catch (err) {
      callback({
        code: status.INTERNAL,
        message: err.message,
      });
    }
  }

  async create(call: QueryRequest, callback: QueryResponse) {
    try {
      const schemaAdapter = this._activeAdapter.getSchemaModel(call.request.schemaName);
      const doc = await schemaAdapter.model.create(call.request.query);

      const docString = JSON.stringify(doc);

      this.grpcSdk.bus?.publish(
        `${MODULE_NAME}:create:${call.request.schemaName}`,
        docString
      );

      callback(null, { result: docString });
    } catch (err) {
      callback({
        code: status.INTERNAL,
        message: err.message,
      });
    }
  }

  async createMany(call: QueryRequest, callback: QueryResponse) {
    try {
      const schemaAdapter = this._activeAdapter.getSchemaModel(call.request.schemaName);
      const docs = await schemaAdapter.model.createMany(call.request.query);

      const docsString = JSON.stringify(docs);

      this.grpcSdk.bus?.publish(
        `${MODULE_NAME}:createMany:${call.request.schemaName}`,
        docsString
      );

      callback(null, { result: docsString });
    } catch (err) {
      callback({
        code: status.INTERNAL,
        message: err.message,
      });
    }
  }

  async findByIdAndUpdate(call: UpdateRequest, callback: QueryResponse) {
    try {
      const schemaAdapter = this._activeAdapter.getSchemaModel(call.request.schemaName);
      const result = await schemaAdapter.model.findByIdAndUpdate(
        call.request.id,
        call.request.query,
        call.request.updateProvidedOnly,
        call.request.populate,
        schemaAdapter.relations,
      );

      const resultString = JSON.stringify(result);

      this.grpcSdk.bus?.publish(
        `${MODULE_NAME}:update:${call.request.schemaName}`,
        resultString
      );

      callback(null, { result: resultString });
    } catch (err) {
      callback({
        code: status.INTERNAL,
        message: err.message,
      });
    }
  }

  async updateMany(call: UpdateManyRequest, callback: QueryResponse) {
    try {
      const schemaAdapter = this._activeAdapter.getSchemaModel(call.request.schemaName);
      const result = await schemaAdapter.model.updateMany(
        call.request.filterQuery,
        call.request.query,
        call.request.updateProvidedOnly
      );

      const resultString = JSON.stringify(result);

      this.grpcSdk.bus?.publish(
        `${MODULE_NAME}:updateMany:${call.request.schemaName}`,
        resultString
      );

      callback(null, { result: resultString });
    } catch (err) {
      callback({
        code: status.INTERNAL,
        message: err.message,
      });
    }
  }

  async deleteOne(call: QueryRequest, callback: QueryResponse) {
    try {
      const schemaAdapter = this._activeAdapter.getSchemaModel(call.request.schemaName);
      const result = await schemaAdapter.model.deleteOne(call.request.query);

      const resultString = JSON.stringify(result);

      this.grpcSdk.bus?.publish(
        `${MODULE_NAME}:delete:${call.request.schemaName}`,
        resultString
      );

      callback(null, { result: resultString });
    } catch (err) {
      callback({
        code: status.INTERNAL,
        message: err.message,
      });
    }
  }

  async deleteMany(call: QueryRequest, callback: QueryResponse) {
    try {
      const schemaAdapter = this._activeAdapter.getSchemaModel(call.request.schemaName);
      const result = await schemaAdapter.model.deleteMany(call.request.query);

      const resultString = JSON.stringify(result);

      this.grpcSdk.bus?.publish(
        `${MODULE_NAME}:delete:${call.request.schemaName}`,
        resultString
      );

      callback(null, { result: resultString });
    } catch (err) {
      callback({
        code: status.INTERNAL,
        message: err.message,
      });
    }
  }

  async countDocuments(call: QueryRequest, callback: QueryResponse) {
    try {
      const schemaAdapter = this._activeAdapter.getSchemaModel(call.request.schemaName);
      const result = await schemaAdapter.model.countDocuments(call.request.query);
      callback(null, { result: JSON.stringify(result) });
    } catch (err) {
      callback({
        code: status.INTERNAL,
        message: err.message,
      });
    }
  }
}
