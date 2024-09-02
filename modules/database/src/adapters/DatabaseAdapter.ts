import {
  ConduitGrpcSdk,
  ConduitModel,
  ConduitSchema,
  GrpcError,
  ModelOptionsIndex,
  RawMongoQuery,
  RawSQLQuery,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import {
  _ConduitSchema,
  ConduitDatabaseSchema,
  IView,
  Schema,
} from '../interfaces/index.js';
import { stitchSchema, validateExtensionFields } from './utils/extensions.js';
import { status } from '@grpc/grpc-js';
import { isEqual, isNil } from 'lodash-es';
import ObjectHash from 'object-hash';
import * as systemModels from '../models/index.js';

export abstract class DatabaseAdapter<T extends Schema> {
  registeredSchemas: Map<string, ConduitDatabaseSchema>;
  models: { [name: string]: T } = {};
  views: { [name: string]: T } = {};
  foreignSchemaCollections: Set<string> = new Set([]); // not in DeclaredSchemas
  protected readonly maxConnTimeoutMs: number;
  protected grpcSdk: ConduitGrpcSdk;
  private legacyDeployment = false; // unprefixed declared schema collection
  private readonly _systemSchemas: Set<string> = new Set();

  protected constructor() {
    this.registeredSchemas = new Map();
    this.maxConnTimeoutMs = parseInt(process.env.MAX_CONN_TIMEOUT_MS ?? '5000');
    this.maxConnTimeoutMs =
      isNaN(this.maxConnTimeoutMs) || this.maxConnTimeoutMs < 0
        ? 5000
        : this.maxConnTimeoutMs;
  }

  get systemSchemas() {
    return Array.from(this._systemSchemas);
  }

  async init(grpcSdk: ConduitGrpcSdk) {
    this.grpcSdk = grpcSdk;
    this.connect();
    await this.ensureConnected();
    this.legacyDeployment = await this.hasLegacyCollections();
  }

  async registerSystemSchema(schema: ConduitSchema, isReplica: boolean) {
    // @dirty-type-cast
    await this.createSchemaFromAdapter(schema, false, false, isReplica);
    this._systemSchemas.add(schema.name);
  }

  schemaInSystemSchemas(schemaName: string) {
    const systemSchemas = this.systemSchemas.map(s => s.toLowerCase());
    return systemSchemas.includes(schemaName.toLowerCase());
  }

  /**
   * Introspects all schemas of current db connection, registers them to Conduit
   */
  abstract introspectDatabase(): Promise<ConduitSchema[]>;

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
    this.models = this.models || {};
    this.assignFields(schema);
    await this.updateCollectionName(schema, imported);
    await this.checkModelOwnershipAndPermissions(schema);
    await this.addExtensionsFromSchemaModel(schema, gRPC);
    stitchSchema(schema as ConduitDatabaseSchema); // @dirty-type-cast
    const schemaUpdate = this.registeredSchemas.has(schema.name);
    const createdSchema = await this._createSchemaFromAdapter(
      schema,
      !instanceSync,
      instanceSync,
    );
    this.hashSchemaFields(schema as ConduitDatabaseSchema); // @dirty-type-cast
    if (!instanceSync && !schemaUpdate) {
      ConduitGrpcSdk.Metrics?.increment('registered_schemas_total', 1, {
        imported: imported ? 'true' : 'false',
      });
    }
    if (!instanceSync) this.publishSchema(schema as ConduitDatabaseSchema); // @dirty-type-cast
    return createdSchema;
  }

  async createViewFromAdapter(
    viewData: {
      modelName: string;
      viewName: string;
      joinedSchemas: string[];
      query: any;
    },
    instanceSync = false,
  ) {
    await this.createView(
      viewData.modelName,
      viewData.viewName,
      viewData.joinedSchemas,
      viewData.query,
    );
    if (!instanceSync) {
      this.publishView(
        viewData.modelName,
        viewData.viewName,
        viewData.joinedSchemas,
        viewData.query,
      );
    }
  }

  abstract getCollectionName(schema: ConduitSchema): string;

  /**
   * Given a schema name, returns the schema adapter assigned
   * @param schemaName
   */
  getSchema(schemaName: string): ConduitSchema {
    if (this.models && this.models[schemaName]) {
      return this.models[schemaName].originalSchema;
    } else if (this.views && this.views[schemaName]) {
      return this.views[schemaName].originalSchema;
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
  };

  abstract getDatabaseType(): string;

  abstract createIndexes(
    schemaName: string,
    indexes: ModelOptionsIndex[],
    callerModule: string,
  ): Promise<string>;

  abstract getIndexes(schemaName: string): Promise<ModelOptionsIndex[]>;

  abstract createView(
    modelName: string,
    viewName: string,
    joinedSchemas: string[],
    query: any,
  ): Promise<void>;

  abstract deleteView(viewName: string): Promise<void>;

  abstract deleteIndexes(schemaName: string, indexNames: string[]): Promise<string>;

  abstract execRawQuery(
    schemaName: string,
    rawQuery: RawMongoQuery | RawSQLQuery,
  ): Promise<any>;

  abstract syncSchema(name: string): Promise<void>;

  fixDatabaseSchemaOwnership(schema: ConduitSchema) {
    const dbSchemas = ['CustomEndpoints', '_PendingSchemas', 'MigratedSchemas', 'Views'];
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

  async compareAndStoreMigratedSchema(schema: ConduitSchema) {
    if (['_DeclaredSchema', 'MigratedSchemas'].includes(schema.name)) {
      return;
    }
    const storedSchema = await this.models['_DeclaredSchema'].findOne({
      name: schema.name,
    });
    if (isNil(storedSchema)) {
      return;
    }
    if (isEqual(schema.fields, storedSchema.fields)) {
      return;
    }
    const lastMigratedSchemas = await this.models['MigratedSchemas'].findMany(
      { name: storedSchema.name },
      { skip: 1, sort: { version: -1 } },
    );
    const lastVersion =
      lastMigratedSchemas.length === 0 ? 0 : lastMigratedSchemas[0].version;
    await this.models['MigratedSchemas'].create({
      name: storedSchema.name,
      ownerModule: storedSchema.ownerModule,
      version: lastVersion + 1,
      schema: storedSchema,
    });
  }

  async registerAuthorizationDefinitions() {
    const models = await this.models!['_DeclaredSchema'].findMany({
      'modelOptions.conduit.authorization.enabled': true,
    });
    for (const model of models) {
      this.grpcSdk.authorization?.defineResource({
        name: model.name,
        relations: [
          { name: 'owner', resourceType: ['User', '*'] },
          { name: 'reader', resourceType: ['User', '*'] },
          { name: 'editor', resourceType: ['User', '*'] },
        ],
        permissions: [
          {
            name: 'read',
            roles: [
              'reader',
              'reader->read',
              'editor',
              'editor->read',
              'owner',
              'owner->read',
            ],
          },
          { name: 'edit', roles: ['editor', 'editor->edit', 'owner', 'owner->edit'] },
          {
            name: 'delete',
            roles: ['editor', 'editor->delete', 'owner', 'owner->delete'],
          },
        ],
      });
    }
  }

  async recoverSchemasFromDatabase() {
    let models = await this.models!['_DeclaredSchema'].findMany({
      $or: [
        {
          parentSchema: '',
        },
        {
          parentSchema: null,
        },
        { parentSchema: { $exists: false } },
      ],
    });
    models = models
      // do not recover system schemas as they have already been
      .filter((model: _ConduitSchema) => {
        let isSystemModel = false;
        Object.values(systemModels).forEach((systemModel: ConduitSchema) => {
          systemModel.name === model.name && (isSystemModel = true);
        });
        return !isSystemModel;
      })
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
          true,
        );
      });

    await Promise.all(models);
  }

  async recoverViewsFromDatabase() {
    let views = await this.models!['Views'].findMany({});
    views = views.map((view: IView) => {
      return this.createView(
        view.originalSchema,
        view.name,
        view.joinedSchemas,
        view.query,
      );
    });
    await Promise.all(views);
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
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        `Schema ${schemaName} is not extendable`,
      );
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
      const date = new Date(); // TODO FORMAT
      // Create Extension
      schema.extensions.push({
        fields: extFields,
        ownerModule: extOwner,
        createdAt: date,
        updatedAt: date,
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

  /**
   * Publishes view for Database (multi-instance) synchronization
   */
  publishView(modelName: string, viewName: string, joinedSchemas: string[], query: any) {
    // @dirty-type-cast
    this.grpcSdk.bus!.publish(
      'database:create:view',
      JSON.stringify({
        modelName,
        viewName,
        joinedSchemas,
        query,
      }),
    );
  }

  protected abstract connect(): void;

  protected abstract ensureConnected(): Promise<void>;

  /**
   * Checks whether DeclaredSchema collection name is unprefixed
   */
  protected abstract hasLegacyCollections(): Promise<boolean>;

  abstract guaranteeView(viewName: string): Promise<T>;

  protected abstract _createSchemaFromAdapter(
    schema: ConduitSchema,
    saveToDb: boolean,
    instanceSync: boolean,
  ): Promise<Schema>;

  protected async saveSchemaToDatabase(schema: ConduitSchema) {
    if (schema.name === '_DeclaredSchema') return;
    const model = await this.models['_DeclaredSchema'].findOne({ name: schema.name });
    if (model) {
      await this.models['_DeclaredSchema'].findByIdAndUpdate(model._id, {
        name: schema.name,
        fields: schema.fields,
        parentSchema: schema.parentSchema,
        extensions: (schema as ConduitDatabaseSchema).extensions, // @dirty-type-cast
        compiledFields: (schema as ConduitDatabaseSchema).compiledFields, // @dirty-type-cast
        modelOptions: schema.modelOptions,
        ownerModule: schema.ownerModule,
        collectionName: schema.collectionName,
      });
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

  private assignFields(schema: ConduitSchema) {
    if (!Object(schema.modelOptions).hasOwnProperty('timestamps')) {
      schema.modelOptions.timestamps = true;
    }
    const fields = {
      _id: { type: TYPE.ObjectId, required: true, unique: true },
    };
    if (schema.modelOptions.timestamps) {
      Object.assign(fields, {
        createdAt: { type: TYPE.Date, required: false },
        updatedAt: { type: TYPE.Date, required: false },
      });
    }
    Object.assign(schema.fields, fields);
  }

  private async updateCollectionName(schema: ConduitSchema, imported: boolean) {
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
          if (!collectionName.startsWith('cnd_')) {
            collectionName = collectionName.startsWith('_')
              ? `cnd${collectionName}`
              : `cnd_${collectionName}`;
          }
        } else {
          // recover collection name from DeclaredSchema
          collectionName = declaredSchema.collectionName;
        }
      }
      (schema as _ConduitSchema).collectionName = collectionName; // @dirty-type-cast
    }
  }

  private async checkModelOwnershipAndPermissions(schema: ConduitSchema) {
    const owned = await this.checkModelOwnership(schema);
    if (!owned) {
      throw new GrpcError(status.PERMISSION_DENIED, 'Not authorized to modify model');
    }
    this.addSchemaPermissions(schema);
  }

  private async addExtensionsFromSchemaModel(schema: ConduitSchema, gRPC: boolean) {
    if (schema.name !== '_DeclaredSchema' && gRPC) {
      const schemaModel = await this.getSchemaModel('_DeclaredSchema').model.findOne({
        name: schema.name,
      });
      if (schemaModel?.extensions?.length > 0) {
        (schema as _ConduitSchema).extensions = schemaModel.extensions; // @dirty-type-cast
      }
    }
  }

  private hashSchemaFields(schema: ConduitDatabaseSchema) {
    return (this.models[schema.name].fieldHash = ObjectHash.sha1(schema.compiledFields));
  }
}
