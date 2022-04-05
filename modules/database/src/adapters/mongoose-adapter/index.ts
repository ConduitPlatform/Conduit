import { ConnectionOptions, Mongoose } from 'mongoose';
import { MongooseSchema } from './MongooseSchema';
import { schemaConverter } from './SchemaConverter';
import { ConduitSchema, GrpcError } from '@conduitplatform/grpc-sdk';
import { systemRequiredValidator } from '../utils/validateSchemas';
import { DatabaseAdapter } from '../DatabaseAdapter';
import { stitchSchema } from "../utils/extensions";
import { status } from '@grpc/grpc-js';
import { mongoSchemaConverter } from '../../introspection/mongoose/utils';
let parseSchema = require('mongodb-schema');
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
    return new Promise<void>((resolve, reject) => {
      let db = this.mongoose.connection;
      db.on('connected', () => {
        console.log('MongoDB: Database is connected');
        resolve();
      });

      db.on('error', (err: any) => {
        console.error('MongoDB: Connection error:', err.message);
        reject();
      });

      db.once('open', function callback() {
        console.info('MongoDB: Connection open!');
        resolve();
      });

      db.on('reconnected', function () {
        console.log('MongoDB: Database reconnected!');
        resolve();
      });

      db.on('disconnected', function () {
        console.log('MongoDB: Database Disconnected');
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

  async isConduitDB(): Promise<boolean> {
    const collectionNames = (await this.mongoose.connection.db.listCollections().toArray()).map(c => c.name);
    return  collectionNames.includes('_declaredschemas');
  }

  async introspectDatabase(): Promise<DatabaseAdapter<any>> {
    const db = this.mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('collections', collections);

    (await db.listCollections().toArray()).forEach(async (c) => {
      parseSchema(
        db.collection(c.name).find(),
        async (err: Error, originalSchema: any) => {
          if (err) {
            throw new GrpcError(status.INTERNAL, err.message);
          }
          originalSchema = mongoSchemaConverter(originalSchema);

          const schema = new ConduitSchema(c.name, originalSchema, {
            timestamps: true,
            conduit: {
              noSync: true,
              permissions: {
                extendable: false,
                canCreate: false,
                canModify: 'Nothing',
                canDelete: false,
              },
              cms: {
                authentication: false,
                crudOperations: false,
                enabled: false,
              },
            },
          });
          schema.ownerModule = 'database';
          console.log(schema);

          await this.createSchemaFromAdapter(schema);
        }
      );
    });
    return this;
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
    const original: any = JSON.parse(JSON.stringify(schema));
    stitchSchema(schema);
    const newSchema = schemaConverter(schema);

    this.registeredSchemas.set(schema.name, schema);
    this.models[schema.name] = new MongooseSchema(
      this.mongoose,
      newSchema,
      schema,
      deepPopulate,
      this
    );
    if (schema.name !== '_DeclaredSchema') {
      await this.saveSchemaToDatabase(original);
    }

    return this.models[schema.name];
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
    this.models!['_DeclaredSchema']
      .findOne(JSON.stringify({ name: schemaName }))
      .then( model => {
        if (model) {
          this.models!['_DeclaredSchema']
            .deleteOne(JSON.stringify({name: schemaName}))
            .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); })
        }
      });

    delete this.models![schemaName];
    delete this.mongoose.connection.models[schemaName];
    return 'Schema deleted!';
  }
}
