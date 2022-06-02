import { ConnectionOptions, Mongoose } from 'mongoose';
import { MongooseSchema } from './MongooseSchema';
import { schemaConverter } from './SchemaConverter';
import { ConduitSchema, GrpcError } from '@conduitplatform/grpc-sdk';
import { systemRequiredValidator } from '../utils/validateSchemas';
import { DatabaseAdapter } from '../DatabaseAdapter';
import { stitchSchema } from "../utils/extensions";
import { status } from '@grpc/grpc-js';
import pluralize from '../../utils/pluralize';
import {
  INITIAL_DB_SCHEMAS,
  mongoSchemaConverter,
} from '../../introspection/mongoose/utils';
import { isNil } from 'lodash';
import { isMatch } from 'lodash';
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
  }

  async ensureConnected(): Promise<any> {
    return new Promise<void>((resolve, reject) => {
      let db = this.mongoose.connection;
      db.on('connected', () => {
        console.log('MongoDB: Database is connected');
        resolve();
      });

      db.on('error', (err) => {
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
    this.mongoose = new Mongoose();
    this.mongoose
      .connect(this.connectionString, this.options)
      .then(() => {
        deepPopulate = deepPopulate(this.mongoose);
      })
      .catch((err) => {
        console.log(err);
        throw new GrpcError(status.INTERNAL, 'Connection with Mongo not possible');
      });
  }

  async isPopulated(): Promise<boolean> {
    return (
      (await this.mongoose.connection.db.listCollections().toArray()).filter(
        (c) => c.name !== '_declaredschemas'
      ).length > 0
    );
  }

  async isConduitDb(): Promise<boolean> {
    return !!(await this.mongoose.connection.db.collection('_declaredschemas').findOne({
      ownerModule: 'core',
    }));
  }

  async introspectDatabase(isConduitDb: boolean = true): Promise<ConduitSchema[]> {
    let introspectedSchemas: ConduitSchema[] = [];
    const db = this.mongoose.connection.db;
    const schemaOptions = {
      timestamps: true,
      conduit: {
        noSync: true,
        permissions: {
          extendable: false,
          canCreate: false,
          canModify: 'Nothing' as 'Everything' | 'Nothing' | 'ExtensionOnly',
          canDelete: false,
        },
        cms: {
          authentication: false,
          crudOperations: {
            create: {
              enabled: false,
              authenticated: false,
            },
            read: {
              enabled: false,
              authenticated: false,
            },
            update: {
              enabled: false,
              authenticated: false,
            },
            delete: {
              enabled: false,
              authenticated: false,
            },
          },
          enabled: true,
        },
      },
    };
    let schemaNames: string[] = [];

    if (isConduitDb) {
      await db.collection('_pendingschemas').deleteMany({});
      // Reintrospect schemas
      let declaredSchemas = await this.getSchemaModel('_DeclaredSchema').model.findMany(
        {}
      );
      // Remove declared schemas with imported:true
      let schemas = (await db.listCollections().toArray()).filter(
        (schema: ConduitSchema) => {
          // Filter out non-imported declared schemas
          return (
            !INITIAL_DB_SCHEMAS.includes(schema.name) &&
            !declaredSchemas.find((declaredSchema: ConduitSchema) => {
              return (
                declaredSchema.name === schema.name &&
                isNil((declaredSchema as any).modelOptions.conduit!.imported)
              );
            })
          );
        }
      );
      schemas = await Promise.all(
        schemas.map(async (schema: ConduitSchema) => {
          const declaredSchema = declaredSchemas.find(
            (declaredSchema: ConduitSchema) =>
              pluralize(declaredSchema.name) === pluralize(schema.name)
          );
          if (!isNil(declaredSchema)) {
            if (declaredSchema.ownerModule === 'database') {
              // check for diffs in existing schemas
              await parseSchema(
                db.collection(schema.name).find(),
                async (err: Error, originalSchema: any) => {
                  if (err) {
                    throw new GrpcError(status.INTERNAL, err.message);
                  }
                  originalSchema = mongoSchemaConverter(originalSchema);
                  schema = new ConduitSchema(
                    schema.name,
                    originalSchema,
                    schemaOptions,
                    schema.name
                  );
                  if (!isMatch(schema.fields, declaredSchema.fields)) {
                    schemaNames.push(schema.name);
                  }
                }
              );
            }
          } else {
            schemaNames.push(schema.name);
          }
        })
      );
    } else {
      schemaNames = (await db.listCollections().toArray()).map((s) => s.name);
      schemaNames = schemaNames.filter((s) => !INITIAL_DB_SCHEMAS.includes(s));
    }
    await Promise.all(
      schemaNames.map(async (collectionName) => {
        await parseSchema(
          db.collection(collectionName).find(),
          async (err: Error, originalSchema: any) => {
            if (err) {
              throw new GrpcError(status.INTERNAL, err.message);
            }
            originalSchema = mongoSchemaConverter(originalSchema);
            const schema = new ConduitSchema(
              collectionName,
              originalSchema,
              schemaOptions,
              collectionName
            );

            schema.ownerModule = 'database';

            introspectedSchemas.push(schema);
            console.log(`Introspected schema ${collectionName}`);
          }
        );
      })
    );
    return introspectedSchemas;
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

  async deleteSchema(
    schemaName: string,
    deleteData: boolean,
    callerModule: string = 'database'
  ): Promise<string> {
    if (!this.models?.[schemaName])
      throw new GrpcError(status.NOT_FOUND, 'Requested schema not found');
    if (this.models[schemaName].originalSchema.ownerModule !== callerModule) {
      throw new GrpcError(status.PERMISSION_DENIED, 'Not authorized to delete schema');
    }
    if (deleteData) {
      await this.models![schemaName].model.collection.drop().catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    }
    this.models!['_DeclaredSchema'].findOne(JSON.stringify({ name: schemaName })).then(
      (model) => {
        if (model) {
          this.models!['_DeclaredSchema'].deleteOne(
            JSON.stringify({ name: schemaName })
          ).catch((e: Error) => {
            throw new GrpcError(status.INTERNAL, e.message);
          });
        }
      }
    );

    delete this.models![schemaName];
    delete this.mongoose.connection.models[schemaName];
    return 'Schema deleted!';
  }
}
