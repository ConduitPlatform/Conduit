import { ConnectOptions, Mongoose } from 'mongoose';
import { MongooseSchema } from './MongooseSchema.js';
import { schemaConverter } from './SchemaConverter.js';
import {
  ConduitGrpcSdk,
  ConduitSchema,
  GrpcError,
  Indexable,
  ModelOptionsIndexes,
  MongoIndexType,
  RawMongoQuery,
} from '@conduitplatform/grpc-sdk';
import { DatabaseAdapter } from '../DatabaseAdapter.js';
import { validateFieldChanges, validateFieldConstraints } from '../utils/index.js';
import pluralize from '../../utils/pluralize.js';
import { mongoSchemaConverter } from '../../introspection/mongoose/utils.js';
import { status } from '@grpc/grpc-js';
import { checkIfMongoOptions } from './utils.js';
import {
  ConduitDatabaseSchema,
  introspectedSchemaCmsOptionsDefaults,
} from '../../interfaces/index.js';
import { isNil, isEqual } from 'lodash-es';

// @ts-ignore
import * as parseSchema from 'mongodb-schema';

export class MongooseAdapter extends DatabaseAdapter<MongooseSchema> {
  connected: boolean = false;
  mongoose: Mongoose;
  connectionString: string;
  options: ConnectOptions = {
    minPoolSize: 5,
    connectTimeoutMS: this.maxConnTimeoutMs,
    serverSelectionTimeoutMS: this.maxConnTimeoutMs,
  };

  constructor(connectionString: string) {
    super();
    this.connectionString = connectionString;
    this.mongoose = new Mongoose();
  }

  async retrieveForeignSchemas(): Promise<void> {
    const declaredSchemas = await this.getSchemaModel('_DeclaredSchema').model.findMany(
      {},
    );
    const collectionNames: string[] = [];
    (await this.mongoose.connection?.db?.listCollections()?.toArray())?.forEach(c =>
      collectionNames.push(c.name),
    );
    const declaredSchemaCollectionName =
      this.models['_DeclaredSchema'].originalSchema.collectionName;
    for (const collection of collectionNames) {
      if (collection === declaredSchemaCollectionName) continue;
      const collectionInDeclaredSchemas = (declaredSchemas as unknown as ConduitSchema[]) // @dirty-type-cast
        .some((declaredSchema: ConduitSchema) => {
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

  async createView(
    modelName: string,
    viewName: string,
    joinedSchemas: string[],
    query: any,
  ): Promise<void> {
    if (!this.models[modelName]) {
      throw new GrpcError(status.NOT_FOUND, `Model ${modelName} not found`);
    }
    const existingView = this.views[viewName];
    const isQueryEqual = isEqual(existingView?.viewQuery, query);
    if (existingView && isQueryEqual) {
      return;
    }

    const model = this.models[modelName];
    const newSchema: Partial<ConduitSchema> = Object.assign({}, model.schema);
    //@ts-ignore
    newSchema.name = viewName;
    //@ts-ignore
    newSchema.collectionName = viewName;

    if (existingView && !isQueryEqual) {
      await this.deleteView(viewName);
    }
    const viewModel = new MongooseSchema(
      this.grpcSdk,
      this.mongoose,
      newSchema as ConduitSchema,
      model.originalSchema,
      this,
      true,
      query,
    );
    await viewModel.model.createCollection({
      viewOn: model.originalSchema.collectionName,
      pipeline: JSON.parse(query.mongoQuery),
    });
    this.views[viewName] = viewModel;

    const foundView = await this.models['Views'].findOne({ name: viewName });
    if (isNil(foundView)) {
      await this.models['Views'].create({
        name: viewName,
        originalSchema: modelName,
        joinedSchemas: [...new Set(joinedSchemas.concat(modelName))],
        query,
      });
    }
  }

  async guaranteeView(viewName: string) {
    const view = await this.models['Views'].findOne({
      name: viewName,
    });
    if (!view) {
      throw new Error('View not found');
    }
    await this.createView(view.originalSchema, view.name, view.joinedSchemas, view.query);
    return this.views[viewName];
  }

  async deleteView(viewName: string): Promise<void> {
    if (this.views[viewName]) {
      await this.views[viewName].model.collection.drop();
    }
    await this.models['Views'].deleteOne({ name: viewName });
    delete this.views[viewName];
    delete this.mongoose.models[viewName];
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
        cms: introspectedSchemaCmsOptionsDefaults,
      },
    };
    const declaredSchemas = await this.getSchemaModel('_DeclaredSchema').model.findMany(
      {},
    );
    // Wipe Pending Schemas
    const pendingSchemaCollectionName =
      this.models['_PendingSchemas'].originalSchema.collectionName;
    await db?.collection(pendingSchemaCollectionName).deleteMany({});
    // Update Collection Names and Find Introspectable Schemas
    const importedSchemas: string[] = [];
    (declaredSchemas as unknown as ConduitSchema[]).forEach(schema => {
      // @dirty-type-cast
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
          db?.collection(collectionName).find(),
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

  getSchemaModel(schemaName: string): { model: MongooseSchema } {
    if (this.models && this.models[schemaName]) {
      return { model: this.models[schemaName] };
    } else if (this.views && this.views[schemaName]) {
      return { model: this.views[schemaName] };
    }
    throw new GrpcError(status.NOT_FOUND, `Schema ${schemaName} not defined yet`);
  }

  async deleteSchema(
    schemaName: string,
    deleteData: boolean,
    callerModule: string = 'database',
    instanceSync = false,
  ): Promise<string> {
    if (!this.models?.[schemaName])
      throw new GrpcError(status.NOT_FOUND, 'Requested schema not found');
    if (instanceSync) {
      delete this.models[schemaName];
      this.mongoose.connection.deleteModel(schemaName);
      return 'Instance synchronized!';
    }
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
      .then(async model => {
        if (model) {
          this.models['_DeclaredSchema']
            .deleteOne(JSON.stringify({ name: schemaName }))
            .catch((e: Error) => {
              throw new GrpcError(status.INTERNAL, e.message);
            });
          if (!instanceSync) {
            ConduitGrpcSdk.Metrics?.decrement('registered_schemas_total', 1, {
              imported: String(!!model.modelOptions.conduit?.imported),
            });
          }
        }
      });

    delete this.models[schemaName];
    this.mongoose.connection.deleteModel(schemaName);
    this.registeredSchemas.delete(schemaName);
    this.grpcSdk.bus!.publish('database:delete:schema', schemaName);
    return 'Schema deleted!';
  }

  getDatabaseType(): string {
    return 'MongoDB';
  }

  async createIndexes(
    schemaName: string,
    indexes: ModelOptionsIndexes[],
    callerModule: string,
  ): Promise<string> {
    if (!this.models[schemaName])
      throw new GrpcError(status.NOT_FOUND, 'Requested schema not found');
    this.checkIndexes(schemaName, indexes, callerModule);
    const collection = this.mongoose.model(schemaName).collection;
    for (const index of indexes) {
      const indexSpecs = [];
      for (let i = 0; i < index.fields.length; i++) {
        const spec: any = {};
        spec[index.fields[i]] = index.types ? index.types[i] : 1;
        indexSpecs.push(spec);
      }
      await collection.createIndex(indexSpecs, index.options).catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    }
    return 'Indexes created!';
  }

  async getIndexes(schemaName: string): Promise<ModelOptionsIndexes[]> {
    if (!this.models[schemaName])
      throw new GrpcError(status.NOT_FOUND, 'Requested schema not found');
    const collection = this.mongoose.model(schemaName).collection;
    const result = await collection.indexes();
    result.filter(index => {
      index.options = {};
      for (const indexEntry of Object.entries(index)) {
        if (indexEntry[0] === 'key' || indexEntry[0] === 'options') {
          continue;
        }
        if (indexEntry[0] === 'v') {
          delete index.v;
          continue;
        }
        index.options[indexEntry[0]] = indexEntry[1];
        delete index[indexEntry[0]];
      }
      index.fields = [];
      index.types = [];
      for (const keyEntry of Object.entries(index.key)) {
        index.fields.push(keyEntry[0]);
        index.types.push(keyEntry[1]);
        //@ts-expect-error
        delete index.key;
      }
    });
    return result as unknown as ModelOptionsIndexes[];
  }

  async deleteIndexes(schemaName: string, indexNames: string[]): Promise<string> {
    if (!this.models[schemaName])
      throw new GrpcError(status.NOT_FOUND, 'Requested schema not found');
    const collection = this.mongoose.model(schemaName).collection;
    for (const name of indexNames) {
      collection.dropIndex(name).catch(() => {
        throw new GrpcError(status.INTERNAL, 'Unsuccessful index deletion');
      });
    }
    return 'Indexes deleted';
  }

  async execRawQuery(schemaName: string, rawQuery: RawMongoQuery) {
    let collection = this.models[schemaName]?.model.collection;
    if (!collection) {
      collection = this.views[schemaName]?.model.collection;
    }
    let result;
    try {
      const queryOperation = Object.keys(rawQuery).filter(v => {
        if (v !== 'options') return v;
      })[0];
      // @ts-ignore
      result = await collection[queryOperation](
        rawQuery[queryOperation as keyof RawMongoQuery],
        rawQuery.options,
      );
      if (queryOperation === 'aggregate') {
        result = await result.toArray();
      }
    } catch (e) {
      throw new GrpcError(status.INTERNAL, (e as Error).message);
    }
    return result;
  }

  async syncSchema(name: string) {
    return;
  }

  protected connect() {
    this.mongoose = new Mongoose();
    ConduitGrpcSdk.Logger.log('Connecting to database...');
    this.mongoose
      .connect(this.connectionString, this.options)
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

  protected async ensureConnected(): Promise<void> {
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

  protected async hasLegacyCollections() {
    return !!(await this.mongoose.connection.db?.listCollections().toArray())?.find(
      c => c.name === '_declaredschemas',
    );
  }

  protected async _createSchemaFromAdapter(
    schema: ConduitDatabaseSchema,
    saveToDb: boolean = true,
    isInstanceSync: boolean = false,
  ): Promise<MongooseSchema> {
    let compiledSchema = JSON.parse(JSON.stringify(schema));
    validateFieldConstraints(compiledSchema, 'mongodb');
    compiledSchema.fields = (schema as ConduitDatabaseSchema).compiledFields;
    if (this.registeredSchemas.has(compiledSchema.name)) {
      if (compiledSchema.name !== 'Config') {
        compiledSchema = validateFieldChanges(
          this.registeredSchemas.get(compiledSchema.name)!,
          compiledSchema,
        );
      }
      this.mongoose.connection.deleteModel(compiledSchema.name);
    }

    const newSchema = schemaConverter(compiledSchema);
    const indexes = newSchema.modelOptions.indexes;
    delete newSchema.modelOptions.indexes;
    this.registeredSchemas.set(
      schema.name,
      Object.freeze(JSON.parse(JSON.stringify(schema))),
    );
    this.models[schema.name] = new MongooseSchema(
      this.grpcSdk,
      this.mongoose,
      newSchema,
      schema,
      this,
    );
    if (saveToDb) {
      await this.compareAndStoreMigratedSchema(schema);
      await this.saveSchemaToDatabase(schema);
    }

    if (indexes && !isInstanceSync) {
      await this.createIndexes(schema.name, indexes, schema.ownerModule);
    }
    return this.models[schema.name];
  }

  private checkIndexes(
    schemaName: string,
    indexes: ModelOptionsIndexes[],
    callerModule: string,
  ) {
    for (const index of indexes) {
      const options = index.options;
      const types = index.types;
      if (!options && !types) continue;
      if (options) {
        if (!checkIfMongoOptions(options)) {
          throw new GrpcError(status.INTERNAL, 'Invalid index options for mongoDB');
        }
        if (
          Object.keys(options).includes('unique') &&
          this.models[schemaName].originalSchema.ownerModule !== callerModule
        ) {
          throw new GrpcError(
            status.PERMISSION_DENIED,
            'Not authorized to create unique index',
          );
        }
      }
      if (types) {
        if (!Array.isArray(types) || types.length !== index.fields.length) {
          throw new GrpcError(status.INTERNAL, 'Invalid index types format');
        }
        for (const type of types) {
          if (!Object.values(MongoIndexType).includes(type)) {
            throw new GrpcError(status.INTERNAL, 'Invalid index type for mongoDB');
          }
        }
      }
    }
  }
}
