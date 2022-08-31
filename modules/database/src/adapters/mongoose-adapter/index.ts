import { ConnectOptions, Mongoose } from 'mongoose';
import { MongooseSchema } from './MongooseSchema';
import { schemaConverter } from './SchemaConverter';
import ConduitGrpcSdk, {
  ConduitSchemaOptions,
  ConduitSchema,
  GrpcError,
  Indexable,
} from '@conduitplatform/grpc-sdk';
import { ConduitDatabaseSchema } from '../../interfaces/ConduitDatabaseSchema';
import { systemRequiredValidator } from '../utils/validateSchemas';
import { DatabaseAdapter } from '../DatabaseAdapter';
import { stitchSchema } from '../utils/extensions';
import { status } from '@grpc/grpc-js';
import pluralize from '../../utils/pluralize';
import { mongoSchemaConverter } from '../../introspection/mongoose/utils';

const parseSchema = require('mongodb-schema');
let deepPopulate = require('mongoose-deep-populate');

type _ConduitSchema = Omit<ConduitSchema, 'modelOptions'> & {
  modelOptions: ConduitSchemaOptions;
};

export class MongooseAdapter extends DatabaseAdapter<MongooseSchema> {
  connected: boolean = false;
  mongoose: Mongoose;
  connectionString: string;
  options: ConnectOptions = {
    keepAlive: true,
    minPoolSize: 5,
    connectTimeoutMS: this.maxConnTimeoutMs,
    serverSelectionTimeoutMS: this.maxConnTimeoutMs,
  };

  constructor(connectionString: string) {
    super();
    this.connectionString = connectionString;
    this.mongoose = new Mongoose();
  }

  async ensureConnected(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const db = this.mongoose.connection;
      db.on('connected', () => {
        ConduitGrpcSdk.Logger.log('MongoDB: Database is connected');
        resolve();
      });

      db.on('error', err => {
        ConduitGrpcSdk.Logger.error('MongoDB: Connection error:', err.message);
        reject();
      });

      db.once('open', function callback() {
        ConduitGrpcSdk.Logger.info('MongoDB: Connection open!');
        resolve();
      });

      db.on('reconnected', function () {
        ConduitGrpcSdk.Logger.log('MongoDB: Database reconnected!');
        resolve();
      });

      db.on('disconnected', function () {
        ConduitGrpcSdk.Logger.warn('MongoDB: Database Disconnected');
        reject();
      });
    });
  }

  connect() {
    this.mongoose = new Mongoose();
    ConduitGrpcSdk.Logger.log('Connecting to database...');
    this.mongoose
      .connect(this.connectionString, this.options)
      .then(() => {
        deepPopulate = deepPopulate(this.mongoose);
      })
      .catch(err => {
        ConduitGrpcSdk.Logger.error('Unable to connect to the database: ', err);
        throw new Error();
      })
      .then(() => {
        ConduitGrpcSdk.Logger.log('Mongoose connection established successfully');
      });
    this.mongoose.set('debug', () => {
      ConduitGrpcSdk.Metrics?.increment('database_queries_total');
    });
  }

  async retrieveForeignSchemas(): Promise<void> {
    const declaredSchemas = await this.getSchemaModel('_DeclaredSchema').model.findMany(
      {},
    );
    const collectionNames: string[] = [];
    (await this.mongoose.connection.db.listCollections().toArray()).forEach(c =>
      collectionNames.push(c.name),
    );
    const declaredSchemaCollectionName =
      this.models['_DeclaredSchema'].originalSchema.collectionName;
    for (const collection of collectionNames) {
      if (collection === declaredSchemaCollectionName) continue;
      const collectionInDeclaredSchemas = (
        declaredSchemas as unknown as ConduitSchema[]
      ).some((declaredSchema: ConduitSchema) => {
        if (declaredSchema.collectionName && declaredSchema.collectionName !== '') {
          return declaredSchema.collectionName === collection;
        } else {
          return pluralize(declaredSchema.name) === collection;
        }
      });
      if (!collectionInDeclaredSchemas) {
        this.foreignSchemaCollections.add(collection);
      }
    }
  }

  async introspectDatabase(): Promise<ConduitSchema[]> {
    const introspectedSchemas: ConduitSchema[] = [];
    const db = this.mongoose.connection.db;
    const modelOptions = {
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
    const declaredSchemas = await this.getSchemaModel('_DeclaredSchema').model.findMany(
      {},
    );
    // Wipe Pending Schemas
    const pendingSchemaCollectionName =
      this.models['_PendingSchemas'].originalSchema.collectionName;
    await db.collection(pendingSchemaCollectionName).deleteMany({});
    // Update Collection Names and Find Introspectable Schemas
    const importedSchemas: string[] = [];
    (declaredSchemas as unknown as ConduitSchema[]).forEach((schema: ConduitSchema) => {
      if (schema.modelOptions.conduit!.imported) {
        importedSchemas.push(schema.collectionName);
      }
    });
    const introspectableSchemas = Array.from(this.foreignSchemaCollections).concat(
      importedSchemas,
    );
    // Process Schemas
    await Promise.all(
      introspectableSchemas.map(async collectionName => {
        await parseSchema(
          db.collection(collectionName).find(),
          async (err: Error, originalSchema: Indexable) => {
            if (err) {
              throw new GrpcError(status.INTERNAL, err.message);
            }
            originalSchema = mongoSchemaConverter(originalSchema);
            const schema = new ConduitSchema(
              collectionName,
              originalSchema,
              modelOptions,
              collectionName,
            );
            schema.ownerModule = 'database';
            introspectedSchemas.push(schema);
            ConduitGrpcSdk.Logger.log(`Introspected schema ${collectionName}`);
          },
        );
      }),
    );
    return introspectedSchemas;
  }

  getCollectionName(schema: ConduitSchema) {
    return schema.collectionName && schema.collectionName !== ''
      ? schema.collectionName
      : pluralize(schema.name);
  }

  protected async _createSchemaFromAdapter(
    schema: ConduitSchema,
  ): Promise<MongooseSchema> {
    if (this.registeredSchemas.has(schema.name)) {
      if (schema.name !== 'Config') {
        schema = systemRequiredValidator(
          this.registeredSchemas.get(schema.name)!,
          schema,
        );
        // TODO this is a temporary solution because there was an error on updated config schema for invalid schema fields
      }
      this.mongoose.connection.deleteModel(schema.name);
    }
    const owned = await this.checkModelOwnership(schema);
    if (!owned) {
      throw new GrpcError(status.PERMISSION_DENIED, 'Not authorized to modify model');
    }

    this.addSchemaPermissions(schema);
    const original: ConduitDatabaseSchema = JSON.parse(JSON.stringify(schema));
    stitchSchema(schema);
    original.compiledFields = schema.fields;
    const newSchema = schemaConverter(schema);

    this.registeredSchemas.set(schema.name, schema);

    this.models[schema.name] = new MongooseSchema(
      this.mongoose,
      newSchema,
      schema,
      deepPopulate,
      this,
    );
    await this.saveSchemaToDatabase(original);

    return this.models[schema.name];
  }

  getSchemaModel(schemaName: string): { model: MongooseSchema; relations: null } {
    if (this.models && this.models[schemaName]) {
      return { model: this.models[schemaName], relations: null };
    }
    throw new GrpcError(status.NOT_FOUND, `Schema ${schemaName} not defined yet`);
  }

  async checkDeclaredSchemaExistence() {
    return !!(await this.mongoose.connection.db.listCollections().toArray()).find(
      c => c.name === '_declaredschemas',
    );
  }

  async deleteSchema(
    schemaName: string,
    deleteData: boolean,
    callerModule: string = 'database',
  ): Promise<string> {
    if (!this.models?.[schemaName])
      throw new GrpcError(status.NOT_FOUND, 'Requested schema not found');
    if (this.models[schemaName].originalSchema.ownerModule !== callerModule) {
      throw new GrpcError(status.PERMISSION_DENIED, 'Not authorized to delete schema');
    }
    if (deleteData) {
      await this.models[schemaName].model.collection.drop().catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    }
    this.models['_DeclaredSchema']
      .findOne(JSON.stringify({ name: schemaName }))
      .then(model => {
        if (model) {
          this.models['_DeclaredSchema']
            .deleteOne(JSON.stringify({ name: schemaName }))
            .catch((e: Error) => {
              throw new GrpcError(status.INTERNAL, e.message);
            });
        }
      });

    delete this.models[schemaName];
    this.mongoose.connection.deleteModel(schemaName);
    return 'Schema deleted!';
  }
}
