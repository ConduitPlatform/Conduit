import ConduitGrpcSdk, {
  ConduitModel,
  ConduitSchema,
  GrpcError,
  ModelOptionsIndexes,
  RawMongoQuery,
  RawSQLQuery,
  Indexable,
} from '@conduitplatform/grpc-sdk';
import { _ConduitSchema, ConduitDatabaseSchema, Schema } from '../interfaces';
import { stitchSchema, validateExtensionFields } from './utils/extensions';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash';
import ObjectHash from 'object-hash';

export abstract class DatabaseAdapter<T extends Schema> {
  protected readonly maxConnTimeoutMs: number;
  protected grpcSdk: ConduitGrpcSdk;
  private legacyDeployment = false; // unprefixed declared schema collection
  registeredSchemas: Map<string, ConduitSchema>;
  models: { [name: string]: T } = {};
  foreignSchemaCollections: Set<string> = new Set([]); // not in DeclaredSchemas
  private readonly _systemSchemas: Set<string> = new Set();

  protected constructor() {
    this.registeredSchemas = new Map();
    this.maxConnTimeoutMs = parseInt(process.env.MAX_CONN_TIMEOUT_MS ?? '5000');
    this.maxConnTimeoutMs =
      isNaN(this.maxConnTimeoutMs) || this.maxConnTimeoutMs < 0
        ? 5000
        : this.maxConnTimeoutMs;
  }

  async init(grpcSdk: ConduitGrpcSdk) {
    this.grpcSdk = grpcSdk;
    this.connect();
    await this.ensureConnected();
    this.legacyDeployment = await this.hasLegacyCollections();
  }

  async registerSystemSchema(schema: ConduitSchema) {
    // @dirty-type-cast
    await this.createSchemaFromAdapter(schema);
    this._systemSchemas.add(schema.name);
  }

  get systemSchemas() {
    return Array.from(this._systemSchemas);
  }

  schemaInSystemSchemas(schemaName: string) {
    const systemSchemas = this.systemSchemas.map(s => s.toLowerCase());
    return systemSchemas.includes(schemaName.toLowerCase());
  }

  protected abstract connect(): void;

  protected abstract ensureConnected(): Promise<void>;

  /**
   * Introspects all schemas of current db connection, registers them to Conduit
   */
  abstract introspectDatabase(): Promise<ConduitSchema[]>;

  /**
   * Checks whether DeclaredSchema collection name is unprefixed
   */
  protected abstract hasLegacyCollections(): Promise<boolean>;

  /**
   * Retrieves all schemas not related to Conduit and stores them in adapter
   */
  abstract retrieveForeignSchemas(): Promise<void>;

  /**-
   * Registers a schema, creates its collection in the database and updates routing types
   * @param {ConduitSchema} schema
   * @param {boolean} imported Whether schema is an introspected schema
   * @param {boolean} gRPC Merge existing extensions before stitching schema from gRPC
   * @param {boolean} instanceSync Do not republish schema changes for multi-instance sync calls
   */
  async createSchemaFromAdapter(
    schema: ConduitSchema,
    imported = false,
    gRPC = false,
    instanceSync = false,
  ): Promise<Schema> {
    if (!this.models) {
      this.models = {};
    }
    if (imported) {
      this.foreignSchemaCollections.delete(schema.collectionName);
    } else {
      let collectionName = this.getCollectionName(schema);
      if (!this.legacyDeployment && !this.models['_DeclaredSchema']) {
        collectionName = collectionName.startsWith('_')
          ? `cnd${collectionName}`
          : `cnd_${collectionName}`;
      } else if (schema.name !== '_DeclaredSchema') {
        const declaredSchema = await this.models['_DeclaredSchema'].findOne({
          name: schema.name,
        });
        if (!declaredSchema) {
          collectionName = collectionName.startsWith('_')
            ? `cnd${collectionName}`
            : `cnd_${collectionName}`;
        } else {
          // recover collection name from DeclaredSchema
          collectionName = declaredSchema.collectionName;
        }
      }
      (schema as _ConduitSchema).collectionName = collectionName; // @dirty-type-cast
    }
    const owned = await this.checkModelOwnership(schema);
    if (!owned) {
      throw new GrpcError(status.PERMISSION_DENIED, 'Not authorized to modify model');
    }
    this.addSchemaPermissions(schema);
    if (schema.name !== '_DeclaredSchema' && gRPC) {
      const schemaModel = await this.getSchemaModel('_DeclaredSchema').model.findOne({
        name: schema.name,
      });
      if (schemaModel?.extensions?.length > 0) {
        (schema as _ConduitSchema).extensions = schemaModel.extensions; // @dirty-type-cast
      }
    }
    stitchSchema(schema as ConduitDatabaseSchema); // @dirty-type-cast
    const schemaUpdate = this.registeredSchemas.has(schema.name);
    const createdSchema = await this._createSchemaFromAdapter(schema);
    this.hashSchemaFields(schema as ConduitDatabaseSchema); // @dirty-type-cast
    if (!instanceSync && !schemaUpdate) {
      ConduitGrpcSdk.Metrics?.increment('registered_schemas_total', 1, {
        imported: imported ? 'true' : 'false',
      });
    }
    if (!instanceSync) this.publishSchema(schema as ConduitDatabaseSchema); // @dirty-type-cast
    return createdSchema;
  }

  protected abstract _createSchemaFromAdapter(schema: ConduitSchema): Promise<Schema>;

  abstract getCollectionName(schema: ConduitSchema): string;

  /**
   * Given a schema name, returns the schema adapter assigned
   * @param schemaName
   */
  getSchema(schemaName: string): ConduitSchema {
    if (this.models && this.models[schemaName]) {
      return this.models[schemaName].originalSchema;
    }
    throw new GrpcError(status.NOT_FOUND, `Schema ${schemaName} not defined yet`);
  }

  getSchemas(): ConduitSchema[] {
    if (!this.models) {
      return [];
    }
    const self = this;
    return Object.keys(this.models).map(modelName => {
      return self.models[modelName].originalSchema;
    });
  }

  abstract deleteSchema(
    schemaName: string,
    deleteData: boolean,
    callerModule: string,
    instanceSync?: boolean,
  ): Promise<string>;

  abstract getSchemaModel(schemaName: string): {
    model: Schema;
    relations: null | Indexable;
  };

  abstract getDatabaseType(): string;

  abstract createIndexes(
    schemaName: string,
    indexes: ModelOptionsIndexes[],
    callerModule: string,
  ): Promise<string>;

  abstract getIndexes(schemaName: string): Promise<ModelOptionsIndexes[]>;

  abstract deleteIndexes(schemaName: string, indexNames: string[]): Promise<string>;

  abstract execRawQuery(
    schemaName: string,
    rawQuery: RawMongoQuery | RawSQLQuery,
  ): Promise<any>;

  fixDatabaseSchemaOwnership(schema: ConduitSchema) {
    const dbSchemas = ['CustomEndpoints', '_PendingSchemas'];
    if (dbSchemas.includes(schema.name)) {
      schema.ownerModule = 'database';
    }
  }

  async checkModelOwnership(schema: ConduitSchema) {
    this.fixDatabaseSchemaOwnership(schema);
    if (schema.name === '_DeclaredSchema') return true;

    const model = await this.models['_DeclaredSchema'].findOne({ name: schema.name });
    if (model && model.parentSchema) return false;
    if (model && model.ownerModule === schema.ownerModule) {
      return true;
    } else if (model) {
      return false;
    }
    return true;
  }

  protected async saveSchemaToDatabase(schema: ConduitSchema) {
    if (schema.name === '_DeclaredSchema') return;
    const model = await this.models['_DeclaredSchema'].findOne({ name: schema.name });
    if (model) {
      await this.models['_DeclaredSchema'].findByIdAndUpdate(
        model._id,
        {
          name: schema.name,
          fields: schema.fields,
          parentSchema: schema.parentSchema,
          extensions: (schema as ConduitDatabaseSchema).extensions, // @dirty-type-cast
          compiledFields: (schema as ConduitDatabaseSchema).compiledFields, // @dirty-type-cast
          modelOptions: schema.modelOptions,
          ownerModule: schema.ownerModule,
          collectionName: schema.collectionName,
        },
        true,
      );
    } else {
      await this.models['_DeclaredSchema'].create({
        name: schema.name,
        fields: schema.fields,
        parentSchema: schema.parentSchema,
        extensions: (schema as ConduitDatabaseSchema).extensions, // @dirty-type-cast
        compiledFields: (schema as ConduitDatabaseSchema).compiledFields, // @dirty-type-cast
        modelOptions: schema.modelOptions,
        ownerModule: schema.ownerModule,
        collectionName: schema.collectionName,
      });
    }
  }

  async recoverSchemasFromDatabase(): Promise<any> {
    let models = await this.models!['_DeclaredSchema'].findMany({
      $or: [
        {
          parentSchema: null,
        },
        { parentSchema: { $exists: false } },
      ],
    });
    models = models
      .map((model: _ConduitSchema) => {
        const schema = new ConduitSchema(
          model.name,
          model.fields,
          model.modelOptions,
          model.collectionName,
        );
        schema.ownerModule = model.ownerModule;
        (schema as ConduitDatabaseSchema).extensions = model.extensions; // @dirty-type-cast
        (schema as ConduitDatabaseSchema).compiledFields = model.compiledFields; // @dirty-type-cast
        return schema;
      })
      .map((model: ConduitSchema) => {
        return this.createSchemaFromAdapter(
          model,
          !!model.modelOptions.conduit?.imported,
          true,
          false,
        );
      });

    await Promise.all(models);
  }

  setSchemaExtension(
    schemaName: string,
    extOwner: string,
    extFields: ConduitModel,
  ): Promise<Schema> {
    const baseSchema = this.getSchema(schemaName);
    if (
      !baseSchema.modelOptions.conduit ||
      !baseSchema.modelOptions.conduit.permissions ||
      !baseSchema.modelOptions.conduit.permissions.extendable
    ) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Schema is not extendable');
    }
    // Hacky input type conversion, clean up input flow types asap // @dirty-type-cast
    const schema: ConduitDatabaseSchema = baseSchema as ConduitDatabaseSchema;
    if (!schema.extensions) {
      schema.extensions = [];
    }
    if (!schema.compiledFields) {
      // could technically be empty, repeated in stitchSchema() call from createSchemaFromAdapter()
      schema.compiledFields = JSON.parse(JSON.stringify(schema.fields));
    }
    validateExtensionFields(schema, extFields, extOwner);
    const extIndex = schema.extensions.findIndex(ext => ext.ownerModule === extOwner);
    const extFieldsCount = Object.keys(extFields).length;
    if (extIndex === -1 && extFieldsCount === 0) {
      return Promise.resolve(schema as unknown as Schema); // @dirty-type-cast
    } else if (extIndex === -1) {
      // Create Extension
      schema.extensions.push({
        fields: extFields,
        ownerModule: extOwner,
        createdAt: new Date(), // TODO FORMAT
        updatedAt: new Date(), // TODO FORMAT
      });
    } else {
      if (extFieldsCount === 0) {
        // Remove Extension
        schema.extensions.splice(extIndex, 1);
      } else {
        // Update Extension
        schema.extensions[extIndex].fields = extFields;
        schema.extensions[extIndex].updatedAt = new Date(); // TODO FORMAT
      }
    }
    return this.createSchemaFromAdapter(schema);
  }

  protected addSchemaPermissions(schema: ConduitSchema) {
    const defaultPermissions = {
      extendable: true,
      canCreate: true,
      canModify: 'Everything',
      canDelete: true,
    } as const;
    if (isNil(schema.modelOptions.conduit)) schema.modelOptions.conduit = {};
    if (isNil(schema.modelOptions.conduit.permissions)) {
      schema.modelOptions.conduit!.permissions = defaultPermissions;
    } else {
      Object.keys(defaultPermissions).forEach(perm => {
        if (!schema.modelOptions.conduit!.permissions!.hasOwnProperty(perm)) {
          // @ts-ignore
          schema.modelOptions.conduit!.permissions![perm] =
            defaultPermissions[perm as keyof typeof defaultPermissions];
        }
      });
    }
    return schema;
  }

  /**
   * Publishes schema types for Database (multi-instance) and Hermes synchronization
   * @param {ConduitDatabaseSchema} schema
   */
  publishSchema(schema: ConduitDatabaseSchema) {
    // @dirty-type-cast
    this.grpcSdk.bus!.publish(
      'database:create:schema',
      JSON.stringify({
        ...schema,
        fieldHash: this.models[schema.name].fieldHash,
      }),
    );
  }

  private hashSchemaFields(schema: ConduitDatabaseSchema) {
    return (this.models[schema.name].fieldHash = ObjectHash.sha1(schema.compiledFields));
  }
}
