import { MongooseAdapter } from './adapters/mongoose-adapter';
import { DatabaseAdapter, SchemaAdapter } from './interfaces';
import ConduitGrpcSdk, {
  ConduitSchema,
  GrpcServer,
} from '@quintessential-sft/conduit-grpc-sdk';
import * as grpc from 'grpc';
import path from 'path';
import {
  CreateSchemaRequest,
  FindOneRequest,
  FindRequest,
  GetSchemaRequest,
  QueryRequest,
  QueryResponse,
  SchemaResponse,
  UpdateManyRequest,
  UpdateRequest,
} from './types';
import { EJSON } from 'bson';
import parse = EJSON.parse;

export class DatabaseProvider {
  private readonly _activeAdapter: DatabaseAdapter;

  constructor(private readonly conduit: ConduitGrpcSdk) {
    const dbType = process.env.databaseType ? process.env.databaseType : 'mongodb';
    const databaseUrl = process.env.databaseURL
      ? process.env.databaseURL
      : 'mongodb://localhost:27017';

    if (dbType === 'mongodb') {
      this._activeAdapter = new MongooseAdapter(databaseUrl);
    } else {
      throw new Error('Arguments not supported');
    }
  }

  private _url: string;

  get url() {
    return this._url;
  }

  initBus() {
    const self = this;
    this.conduit
      .initializeEventBus()
      .then(() => {
        self.conduit.bus?.subscribe('database_provider', (message: string) => {
          if (message === 'request') {
            self._activeAdapter.registeredSchemas.forEach((k) => {
              this.conduit.bus!.publish('database_provider', JSON.stringify(k));
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
        this.conduit.state
          ?.getState()
          .then((r: any) => {
            if (!r || r.length === 0) return;
            let state = JSON.parse(r);
            Object.keys(state).forEach((schemaName: string) => {
              const schema = new ConduitSchema(
                state[schemaName]._name ?? state[schemaName].name,
                state[schemaName]._fields ?? state[schemaName].modelSchema,
                state[schemaName]._modelOptions ?? state[schemaName].modelOptions,
                state[schemaName]._collectionName ?? null
              );
              self._activeAdapter
                .createSchemaFromAdapter(schema)
                .then(() => {})
                .catch(() => {
                  console.log('Failed to create/update schema');
                });
            });
          })
          .catch((err: any) => {
            console.log('Failed to recover state');
            console.error(err);
          });
      })
      .catch(() => {
        console.log('Database provider running without HA');
      });
  }

  publishSchema(schema: any) {
    let sendingSchema = JSON.stringify(schema);
    const self = this;
    this.conduit.state
      ?.getState()
      .then((r: any) => {
        let state = !r || r.length === 0 ? {} : JSON.parse(r);
        self._activeAdapter.registeredSchemas.forEach((k: ConduitSchema) => {
          state[k.name] = {
            _name: k.name,
            _fields: k.fields,
            _modelOptions: k.modelOptions,
            _collectionName: k.collectionName,
          };
        });

        return this.conduit.state?.setState(JSON.stringify(state));
      })
      .then(() => {
        this.conduit.bus!.publish('database_provider', sendingSchema);
        console.log('Updated state');
      })
      .catch((err: any) => {
        console.log('Failed to update state');
        console.error(err);
      });
  }

  ensureIsRunning() {
    return this._activeAdapter.ensureConnected().then(() => {
      let grpcServer = new GrpcServer(process.env.SERVICE_URL);
      this._url = grpcServer.url;
      grpcServer
        .addService(
          path.resolve(__dirname, './database-provider.proto'),
          'databaseprovider.DatabaseProvider',
          {
            createSchemaFromAdapter: this.createSchemaFromAdapter.bind(this),
            getSchema: this.getSchema.bind(this),
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
        )
        .then(() => {
          return grpcServer.start();
        })
        .then(() => {
          console.log('Grpc server is online');
        })
        .catch((err: Error) => {
          console.log('Failed to initialize server');
          console.error(err);
          process.exit(-1);
        });
      return 'ok';
    });
  }

  /**
   * Should accept a JSON schema and output a .ts interface for the adapter
   * @param call
   * @param callback
   */
  createSchemaFromAdapter(call: CreateSchemaRequest, callback: SchemaResponse) {
    let schema = new ConduitSchema(
      call.request.schema.name,
      JSON.parse(call.request.schema.modelSchema),
      JSON.parse(call.request.schema.modelOptions)
    );
    if (schema.name.indexOf('-') >= 0 || schema.name.indexOf(' ') >= 0) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Names cannot include spaces and - characters',
      });
    }
    this._activeAdapter
      .createSchemaFromAdapter(schema)
      .then((schemaAdapter: SchemaAdapter) => {
        let originalSchema = {
          name: schemaAdapter.originalSchema.name,
          modelSchema: JSON.stringify(schemaAdapter.originalSchema.modelSchema),
          modelOptions: JSON.stringify(schemaAdapter.originalSchema.modelOptions),
        };
        this.publishSchema({
          name: call.request.schema.name,
          modelSchema: JSON.parse(call.request.schema.modelSchema),
          modelOptions: JSON.parse(call.request.schema.modelOptions),
        });
        callback(null, {
          schema: originalSchema,
        });
      })
      .catch((err) => {
        callback({
          code: grpc.status.INTERNAL,
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
            modelOptions: JSON.stringify(schemaAdapter.modelOptions),
        },
      });
    } catch (err) {
      callback({
        code: grpc.status.INTERNAL,
        message: err.message,
      });
    }
  }

  async findOne(call: FindOneRequest, callback: QueryResponse) {
    try {
      const schemaAdapter = this._activeAdapter.getSchemaModel(call.request.schemaName);
      const doc = await schemaAdapter.findOne(
        parse(call.request.query),
        call.request.select,
        call.request.populate
      );
      callback(null, { result: JSON.stringify(doc) });
    } catch (err) {
      callback({
        code: grpc.status.INTERNAL,
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

      const docs = await schemaAdapter.findMany(
        parse(call.request.query),
        skip,
        limit,
        select,
        sort,
        populate
      );
      callback(null, { result: JSON.stringify(docs) });
    } catch (err) {
      callback({
        code: grpc.status.INTERNAL,
        message: err.message,
      });
    }
  }

  async create(call: QueryRequest, callback: QueryResponse) {
    try {
      const schemaAdapter = this._activeAdapter.getSchemaModel(call.request.schemaName);
      const doc = await schemaAdapter.create(parse(call.request.query));
      callback(null, { result: JSON.stringify(doc) });
    } catch (err) {
      callback({
        code: grpc.status.INTERNAL,
        message: err.message,
      });
    }
  }

  async createMany(call: QueryRequest, callback: QueryResponse) {
    try {
      const schemaAdapter = this._activeAdapter.getSchemaModel(call.request.schemaName);
      const docs = await schemaAdapter.createMany(parse(call.request.query));
      callback(null, { result: JSON.stringify(docs) });
    } catch (err) {
      callback({
        code: grpc.status.INTERNAL,
        message: err.message,
      });
    }
  }

  async findByIdAndUpdate(call: UpdateRequest, callback: QueryResponse) {
    try {
      const schemaAdapter = this._activeAdapter.getSchemaModel(call.request.schemaName);
      const result = await schemaAdapter.findByIdAndUpdate(
        call.request.id,
        parse(call.request.query)
      );
      callback(null, { result: JSON.stringify(result) });
    } catch (err) {
      callback({
        code: grpc.status.INTERNAL,
        message: err.message,
      });
    }
  }

  async updateMany(call: UpdateManyRequest, callback: QueryResponse) {
    try {
      const schemaAdapter = this._activeAdapter.getSchemaModel(call.request.schemaName);
      const result = await schemaAdapter.updateMany(
        parse(call.request.filterQuery),
        parse(call.request.query)
      );
      callback(null, { result: JSON.stringify(result) });
    } catch (err) {
      callback({
        code: grpc.status.INTERNAL,
        message: err.message,
      });
    }
  }

  async deleteOne(call: QueryRequest, callback: QueryResponse) {
    try {
      const schemaAdapter = this._activeAdapter.getSchemaModel(call.request.schemaName);
      const result = await schemaAdapter.deleteOne(parse(call.request.query));
      callback(null, { result: JSON.stringify(result) });
    } catch (err) {
      callback({
        code: grpc.status.INTERNAL,
        message: err.message,
      });
    }
  }

  async deleteMany(call: QueryRequest, callback: QueryResponse) {
    try {
      const schemaAdapter = this._activeAdapter.getSchemaModel(call.request.schemaName);
      const result = await schemaAdapter.deleteMany(parse(call.request.query));
      callback(null, { result: JSON.stringify(result) });
    } catch (err) {
      callback({
        code: grpc.status.INTERNAL,
        message: err.message,
      });
    }
  }

  async countDocuments(call: QueryRequest, callback: QueryResponse) {
    try {
      const schemaAdapter = this._activeAdapter.getSchemaModel(call.request.schemaName);
      const result = await schemaAdapter.countDocuments(parse(call.request.query));
      callback(null, { result: JSON.stringify(result) });
    } catch (err) {
      callback({
        code: grpc.status.INTERNAL,
        message: err.message,
      });
    }
  }
}
