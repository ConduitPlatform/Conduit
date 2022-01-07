import { ConnectionOptions, Mongoose } from 'mongoose';
import { MongooseSchema } from './MongooseSchema';
import { schemaConverter } from './SchemaConverter';
import { ConduitSchema, GrpcError } from '@quintessential-sft/conduit-grpc-sdk';
import { systemRequiredValidator } from '../utils/validateSchemas';
import { DatabaseAdapter } from '../DatabaseAdapter';
import { _DeclaredSchema } from '../../models';
import { status} from '@grpc/grpc-js';

let deepPopulate = require('mongoose-deep-populate');

export class MongooseAdapter extends DatabaseAdapter<MongooseSchema> {
  connected: boolean = false;
  mongoose: Mongoose;
  connectionString: string;
  options: ConnectionOptions = {
    keepAlive: true,
    poolSize: 10,
    connectTimeoutMS: 30000,
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  };

  registeredSchemas: Map<string, ConduitSchema>;

  constructor(connectionString: string) {
    super();
    this.registeredSchemas = new Map();
    this.connectionString = connectionString;
    this.mongoose = new Mongoose();
    this.connect();
  }

  async ensureConnected(): Promise<any> {
    return new Promise((resolve, reject) => {
      let db = this.mongoose.connection;
      db.on('connected', () => {
        console.log('MongoDB dashboard is connected');
        resolve();
      });

      db.on('error', (err: any) => {
        console.error('Dashboard Connection error:', err.message);
        reject();
      });

      db.once('open', function callback() {
        console.info('Connected to Dashboard Database!');
        resolve();
      });

      db.on('reconnected', function () {
        console.log('Dashboard Database reconnected!');
        resolve();
      });

      db.on('disconnected', function () {
        console.log('Dashboard Database Disconnected');
        reject();
      });
    });
  }

  connect() {
    this.mongoose
      .connect(this.connectionString, this.options)
      .then(() => {
        deepPopulate = deepPopulate(this.mongoose);
      })
      .catch((err: any) => {
        console.log(err);
        throw new GrpcError(status.INTERNAL, 'Connection with Mongo not possible');
      });
  }

  async createSchemaFromAdapter(schema: ConduitSchema): Promise<MongooseSchema> {
    if (!this.models) {
      this.models = {};
    }

    if (this.registeredSchemas.has(schema.name)) {
      if (schema.name !== 'Config') {
        schema = systemRequiredValidator(
          this.registeredSchemas.get(schema.name)!,
          schema
        );
        // TODO this is a temporary solution because there was an error on updated config schema for invalid schema fields
      }
      delete this.mongoose.connection.models[schema.name];
    }
    const owned = await this.checkModelOwnership(schema);
    if (!owned) {
      throw new GrpcError(status.PERMISSION_DENIED, 'Not authorized to modify model');
    }

    this.addSchemaPermissions(schema);

    let newSchema = schemaConverter(schema);

    this.registeredSchemas.set(schema.name, schema);
    this.models[schema.name] = new MongooseSchema(
      this.mongoose,
      newSchema,
      schema,
      deepPopulate,
      this
    );
    if (schema.name !== '_DeclaredSchema') {
      await this.saveSchemaToDatabase(schema);
    }

    return this.models![schema.name];
  }

  getSchema(schemaName: string): ConduitSchema {
    if (this.models && this.models![schemaName]) {
      return this.models![schemaName].originalSchema;
    }
    throw new GrpcError(status.NOT_FOUND, `Schema ${schemaName} not defined yet`);
  }

  getSchemas(): ConduitSchema[] {
    if (!this.models) {
      return [];
    }

    const self = this;
    return Object.keys(this.models).map((modelName) => {
      return self.models![modelName].originalSchema;
    });
  }

  getSchemaModel(schemaName: string): { model: MongooseSchema; relations: any } {
    if (this.models && this.models![schemaName]) {
      return { model: this.models![schemaName], relations: null };
    }
    throw new GrpcError(status.NOT_FOUND, `Schema ${schemaName} not defined yet`);
  }

  async deleteSchema(schemaName: string, deleteData: boolean, callerModule: string = 'database'): Promise<string> {
    if (!this.models?.[schemaName])
      throw new GrpcError(status.NOT_FOUND, 'Requested schema not found');
    if (
      (this.models[schemaName].originalSchema.ownerModule !== callerModule) &&
      (this.models[schemaName].originalSchema.name !== 'SchemaDefinitions') // SchemaDefinitions migration
    ) {
      throw new GrpcError(status.PERMISSION_DENIED, 'Not authorized to delete schema');
    }
    if (deleteData) {
      await this.models![schemaName].model.collection
        .drop()
        .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
    }
    this.models!['_DeclaredSchema'].model
      .findOne({ name: schemaName })
      .then( model => {
        if (model) {
          this.models!['_DeclaredSchema'].model
            .deleteOne({name: schemaName})
            .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); })
        }
      });

    delete this.models![schemaName];
    delete this.mongoose.connection.models[schemaName];
    return 'Schema deleted!'
    // TODO should we delete anything else?
  }
}
