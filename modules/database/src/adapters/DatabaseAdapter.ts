import ConduitGrpcSdk, {
  ConduitModel,
  ConduitSchema,
  GrpcError,
} from '@conduitplatform/grpc-sdk';
import { Schema, _ConduitSchema, ConduitDatabaseSchema } from '../interfaces';
import { stitchSchema, validateExtensionFields } from './utils/extensions';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash';

export abstract class DatabaseAdapter<T extends Schema> {
  protected readonly maxConnTimeoutMs: number;
  registeredSchemas: Map<string, ConduitSchema>;
  models: { [name: string]: T } = {};
  foreignSchemaCollections: Set<string> = new Set([]); // not in DeclaredSchemas

  protected constructor() {
    this.registeredSchemas = new Map();
    this.maxConnTimeoutMs = parseInt(process.env.MAX_CONN_TIMEOUT_MS ?? '5000');
    this.maxConnTimeoutMs =
      isNaN(this.maxConnTimeoutMs) || this.maxConnTimeoutMs < 0
        ? 5000
        : this.maxConnTimeoutMs;
  }

  /**
   * Introspects all schemas of current db connection, registers them to Conduit
   */
  abstract introspectDatabase(): Promise<ConduitSchema[]>;

  /**
   * Check Declared Schema Existence
   */
  abstract checkDeclaredSchemaExistence(): Promise<boolean>;

  /**
   * Retrieves all schemas not related to Conduit and stores them in adapter
   */
  abstract retrieveForeignSchemas(): Promise<void>;

  /**
   * Should accept a JSON schema and output a .ts interface for the adapter
   * @param {ConduitSchema} schema
   * @param {boolean} imported Whether schema is an introspected schema
   * @param {boolean} cndPrefix Whether to prefix the schema's collection name with 'cnd_'
   * @param {boolean} gRPC Merge existing extensions before stitching schema from gRPC
   */
  async createSchemaFromAdapter(
    schema: ConduitSchema,
    imported = false,
    cndPrefix = true,
    gRPC = false,
  ): Promise<Schema> {
    if (!this.models) {
      this.models = {};
    }
    if (imported) {
      this.foreignSchemaCollections.delete(schema.collectionName);
    } else {
      let collectionName = this.getCollectionName(schema);
      if (cndPrefix && !this.models['_DeclaredSchema']) {
        collectionName = collectionName.startsWith('_')
          ? `cnd${collectionName}`
          : `cnd_${collectionName}`;
      } else if (cndPrefix) {
        const declaredSchema = await this.models['_DeclaredSchema'].findOne({
          name: schema.name,
        });
        if (!declaredSchema) {
          collectionName = collectionName.startsWith('_')
            ? `cnd${collectionName}`
            : `cnd_${collectionName}`;
        } else {
          //recover collection name from DeclaredSchema
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
      if (schemaModel.extensions?.length !== 0) {
        (schema as _ConduitSchema).extensions = schemaModel.extensions; // @dirty-type-cast
      }
    }
    stitchSchema(schema as ConduitDatabaseSchema); // @dirty-type-cast
    const createdSchema = this._createSchemaFromAdapter(schema);
    if (!this.registeredSchemas.has(schema.name)) {
      ConduitGrpcSdk.Metrics?.increment('registered_schemas_total', 1, {
        imported: imported ? 'true' : 'false',
      });
    }
    return createdSchema;
  }

  protected abstract _createSchemaFromAdapter(schema: ConduitSchema): Promise<Schema>;

  abstract getCollectionName(schema: ConduitSchema): string;

  async createCustomSchemaFromAdapter(schema: ConduitSchema) {
    schema.ownerModule = 'database';
    return this.createSchemaFromAdapter(schema);
  }

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
  ): Promise<string>;

  abstract getSchemaModel(schemaName: string): { model: Schema; relations: any };

  fixDatabaseSchemaOwnership(schema: ConduitSchema) {
    const dbSchemas = ['CustomEndpoints', '_PendingSchemas'];
    if (dbSchemas.includes(schema.name)) {
      schema.ownerModule = 'database';
    }
  }

  async checkModelOwnership(schema: ConduitSchema) {
    this.fixDatabaseSchemaOwnership(schema);
    if (schema.name === '_DeclaredSchema') return true;

    const model = await this.models['_DeclaredSchema'].findOne(
      JSON.stringify({ name: schema.name }),
    );
    if (model && model.ownerModule === schema.ownerModule) {
      return true;
    } else if (model) {
      return false;
    }
    return true;
  }

  protected async saveSchemaToDatabase(schema: ConduitSchema) {
    if (schema.name === '_DeclaredSchema') return;

    const model = await this.models['_DeclaredSchema'].findOne(
      JSON.stringify({ name: schema.name }),
    );
    if (model) {
      await this.models['_DeclaredSchema'].findByIdAndUpdate(
        model._id,
        JSON.stringify({
          name: schema.name,
          fields: schema.fields,
          extensions: (schema as ConduitDatabaseSchema).extensions, // @dirty-type-cast
          compiledFields: (schema as ConduitDatabaseSchema).compiledFields, // @dirty-type-cast
          modelOptions: schema.modelOptions,
          ownerModule: schema.ownerModule,
          collectionName: schema.collectionName,
        }),
        true,
      );
    } else {
      await this.models['_DeclaredSchema'].create(
        JSON.stringify({
          name: schema.name,
          fields: schema.fields,
          extensions: (schema as ConduitDatabaseSchema).extensions, // @dirty-type-cast
          compiledFields: (schema as ConduitDatabaseSchema).compiledFields, // @dirty-type-cast
          modelOptions: schema.modelOptions,
          ownerModule: schema.ownerModule,
          collectionName: schema.collectionName,
        }),
      );
    }
  }

  async recoverSchemasFromDatabase(): Promise<any> {
    let models = await this.models!['_DeclaredSchema'].findMany('{}');
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
        return this.createSchemaFromAdapter(model);
      });

    await Promise.all(models);
  }

  abstract connect(): void;

  abstract ensureConnected(): Promise<void>;

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
    if (extIndex === -1) {
      // Create Extension
      if (Object.keys(extFields).length === 0) {
        throw new GrpcError(
          status.INVALID_ARGUMENT,
          'Could not create schema extension with no custom fields',
        );
      }
      schema.extensions.push({
        fields: extFields,
        ownerModule: extOwner,
        createdAt: new Date(), // TODO FORMAT
        updatedAt: new Date(), // TODO FORMAT
      });
    } else {
      if (Object.keys(extFields).length === 0) {
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
}
