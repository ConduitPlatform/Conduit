import { MongooseAdapter } from './adapters/mongoose-adapter';
import { DatabaseAdapter, SchemaAdapter } from './interfaces';
import ConduitGrpcSdk, { GrpcServer } from '@quintessential-sft/conduit-grpc-sdk';
import * as grpc from 'grpc';
import path from 'path';
import {
  CreateSchemaRequest,
  FindOneRequest,
  FindRequest,
  GetSchemaRequest, QueryRequest,
  QueryResponse,
  SchemaResponse, UpdateManyRequest, UpdateRequest,
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
              let schema = {
                name: receivedSchema.name,
                modelSchema: receivedSchema.modelSchema,
                modelOptions: receivedSchema.modelOptions,
              };
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
            Object.keys(state).forEach((schema: any) => {
              self._activeAdapter
                .createSchemaFromAdapter(state[schema])
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
        self._activeAdapter.registeredSchemas.forEach((k) => {
          state[k.name] = k;
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
    let schema: { name: string; modelSchema: any; modelOptions: any } = {
      name: call.request.schema.name,
      modelSchema: JSON.parse(call.request.schema.modelSchema),
      modelOptions: JSON.parse(call.request.schema.modelOptions),
    };
    if (schema.name.indexOf('-') >= 0 || schema.name.indexOf(' ') >= 0) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Names cannot include spaces and - characters',
      });
    }
    this._activeAdapter
      .createSchemaFromAdapter(schema)
      .then((schemaAdapter: any) => {
        let schema = schemaAdapter.schema;
        let originalSchema = {
          name: schema.originalSchema.name,
          modelSchema: JSON.stringify(schema.originalSchema.modelSchema),
          modelOptions: JSON.stringify(schema.originalSchema.modelOptions),
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
    this._activeAdapter
      .getSchema(call.request.schemaName)
      .then((schemaAdapter) => {
        callback(null, {
          schema: {
            name: schemaAdapter.schema.name,
            modelSchema: JSON.stringify(schemaAdapter.schema.modelSchema),
            modelOptions: JSON.stringify(schemaAdapter.schema.modelOptions),
          },
        });
      })
      .catch((err) => {
        callback({
          code: grpc.status.INTERNAL,
          message: err.message,
        });
      });
  }

  findOne(call: FindOneRequest, callback: QueryResponse) {
    this._activeAdapter
      .getSchemaModel(call.request.schemaName)
      .then((schemaAdapter: SchemaAdapter) => {
        return schemaAdapter.findOne(
          parse(call.request.query),
          call.request.select,
          call.request.populate
        );
      })
      .then((doc: any) => {
        callback(null, { result: JSON.stringify(doc) });
      })
      .catch((err: any) => {
        callback({
          code: grpc.status.INTERNAL,
          message: err.message,
        });
      });
  }

  findMany(call: FindRequest, callback: QueryResponse) {
    this._activeAdapter
      .getSchemaModel(call.request.schemaName)
      .then((schemaAdapter: SchemaAdapter) => {
        const skip = call.request.skip;
        const limit = call.request.limit;
        const select = call.request.select;
        const sort = call.request.sort ? JSON.parse(call.request.sort) : null;
        const populate = call.request.populate;

        return schemaAdapter.findMany(
          parse(call.request.query),
          skip,
          limit,
          select,
          sort,
          populate
        );
      })
      .then((docs: any) => {
        callback(null, { result: JSON.stringify(docs) });
      })
      .catch((err: any) => {
        callback({
          code: grpc.status.INTERNAL,
          message: err.message,
        });
      });
  }

  create(call: QueryRequest, callback: QueryResponse) {
    this._activeAdapter
      .getSchemaModel(call.request.schemaName)
      .then((schemaAdapter: SchemaAdapter) => {
        return schemaAdapter.create(parse(call.request.query));
      })
      .then((result) => {
        callback(null, { result: JSON.stringify(result) });
      })
      .catch((err: any) => {
        callback({
          code: grpc.status.INTERNAL,
          message: err.message,
        });
      });
  }

  createMany(call: QueryRequest, callback: QueryResponse) {
    this._activeAdapter
      .getSchemaModel(call.request.schemaName)
      .then((schemaAdapter: SchemaAdapter) => {
        return schemaAdapter.createMany(parse(call.request.query));
      })
      .then((result) => {
        callback(null, { result: JSON.stringify(result) });
      })
      .catch((err: any) => {
        callback({
          code: grpc.status.INTERNAL,
          message: err.message,
        });
      });
  }

  findByIdAndUpdate(call: UpdateRequest, callback: QueryResponse) {
    this._activeAdapter
      .getSchemaModel(call.request.schemaName)
      .then((schemaAdapter: SchemaAdapter) => {
        return schemaAdapter.findByIdAndUpdate(
          call.request.id,
          parse(call.request.query)
        );
      })
      .then((result) => {
        callback(null, { result: JSON.stringify(result) });
      })
      .catch((err: any) => {
        callback({
          code: grpc.status.INTERNAL,
          message: err.message,
        });
      });
  }

  updateMany(call: UpdateManyRequest, callback: QueryResponse) {
    this._activeAdapter
      .getSchemaModel(call.request.schemaName)
      .then((schemaAdapter: SchemaAdapter) => {
        return schemaAdapter.updateMany(
          parse(call.request.filterQuery),
          parse(call.request.query)
        );
      })
      .then((result) => {
        callback(null, { result: JSON.stringify(result) });
      })
      .catch((err: any) => {
        callback({
          code: grpc.status.INTERNAL,
          message: err.message,
        });
      });
  }

  deleteOne(call: QueryRequest, callback: QueryResponse) {
    this._activeAdapter
      .getSchemaModel(call.request.schemaName)
      .then((schemaAdapter: SchemaAdapter) => {
        return schemaAdapter.deleteOne(parse(call.request.query));
      })
      .then((result) => {
        callback(null, { result: JSON.stringify(result) });
      })
      .catch((err: any) => {
        callback({
          code: grpc.status.INTERNAL,
          message: err.message,
        });
      });
  }

  deleteMany(call: QueryRequest, callback: QueryResponse) {
    this._activeAdapter
      .getSchemaModel(call.request.schemaName)
      .then((schemaAdapter: SchemaAdapter) => {
        return schemaAdapter.deleteMany(parse(call.request.query));
      })
      .then((result) => {
        callback(null, { result: JSON.stringify(result) });
      })
      .catch((err: any) => {
        callback({
          code: grpc.status.INTERNAL,
          message: err.message,
        });
      });
  }

  countDocuments(call: QueryRequest, callback: QueryResponse) {
    this._activeAdapter
      .getSchemaModel(call.request.schemaName)
      .then((schemaAdapter: SchemaAdapter) => {
        return schemaAdapter.countDocuments(parse(call.request.query));
      })
      .then((result) => {
        callback(null, { result: JSON.stringify(result) });
      })
      .catch((err: any) => {
        callback({
          code: grpc.status.INTERNAL,
          message: err.message,
        });
      });
  }
}
