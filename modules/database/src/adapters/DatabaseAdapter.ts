import ConduitGrpcSdk, {
  ConduitModelOptions,
  ConduitSchema,
  GrpcError,
} from '@conduitplatform/grpc-sdk';
import { DeclaredSchemaExtension, Schema } from '../interfaces';
import { validateExtensionFields } from './utils/extensions';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash';
import { ConduitDatabaseSchema } from '../interfaces/ConduitDatabaseSchema';

type _ConduitSchema = Omit<ConduitSchema, 'schemaOptions'> & {
  modelOptions: ConduitModelOptions;
  extensions: DeclaredSchemaExtension[];
} & {
  -readonly [k in keyof ConduitSchema]: ConduitSchema[k];
};
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
   */
  async createSchemaFromAdapter(
    schema: ConduitSchema,
    imported = false,
    cndPrefix = true,
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
      (schema as _ConduitSchema).collectionName = collectionName;
    }
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

  async getBaseSchema(schemaName: string): Promise<ConduitSchema> {
    if (this.models && this.models[schemaName]) {
      const schema = this.models[schemaName].originalSchema;
      return this.models['_DeclaredSchema']
        .findOne(JSON.stringify({ name: schemaName }), undefined, undefined)
        .then(unstitched => {
          (schema.fields as any) = unstitched.fields;
          return schema;
        });
    } else {
      throw new GrpcError(status.NOT_FOUND, `Schema ${schemaName} not defined yet`);
    }
  }

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
          modelOptions: schema.schemaOptions,
          ownerModule: schema.ownerModule,
          collectionName: schema.collectionName,
          extensions: (schema as ConduitDatabaseSchema).extensions,
        }),
        true,
      );
    } else {
      await this.models['_DeclaredSchema'].create(
        JSON.stringify({
          name: schema.name,
          fields: schema.fields,
          modelOptions: schema.schemaOptions,
          ownerModule: schema.ownerModule,
          collectionName: schema.collectionName,
          extensions: (schema as ConduitDatabaseSchema).extensions,
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
        (schema as ConduitDatabaseSchema).extensions = model.extensions;
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
    schema: ConduitSchema,
    extOwner: string,
    extFields: ConduitSchema['fields'],
  ): Promise<Schema> {
    if (
      !schema.schemaOptions.conduit ||
      !schema.schemaOptions.conduit.permissions ||
      !schema.schemaOptions.conduit.permissions.extendable
    ) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Schema is not extendable');
    }
    validateExtensionFields(schema, extFields, extOwner);
    if (!(schema as ConduitDatabaseSchema).extensions) {
      (schema as ConduitDatabaseSchema).extensions = [];
    }
    const extIndex = (schema as ConduitDatabaseSchema).extensions.findIndex(
      (ext: any) => ext.ownerModule === extOwner,
    );
    if (extIndex === -1) {
      // Create Extension
      if (Object.keys(extFields).length === 0) {
        throw new GrpcError(
          status.INVALID_ARGUMENT,
          'Could not create schema extension with no custom fields',
        );
      }
      (schema as ConduitDatabaseSchema).extensions.push({
        fields: extFields,
        ownerModule: extOwner,
        createdAt: new Date(), // TODO FORMAT
        updatedAt: new Date(), // TODO FORMAT
      });
    } else {
      if (Object.keys(extFields).length === 0) {
        // Remove Extension
        (schema as ConduitDatabaseSchema).extensions.splice(extIndex, 1);
      } else {
        // Update Extension
        (schema as ConduitDatabaseSchema).extensions[extIndex].fields = extFields;
        (schema as ConduitDatabaseSchema).extensions[extIndex].updatedAt = new Date(); // TODO FORMAT
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
    if (isNil(schema.schemaOptions.conduit)) schema.schemaOptions.conduit = {};
    if (isNil(schema.schemaOptions.conduit.permissions)) {
      schema.schemaOptions.conduit!.permissions = defaultPermissions;
    } else {
      Object.keys(defaultPermissions).forEach(perm => {
        if (!schema.schemaOptions.conduit!.permissions!.hasOwnProperty(perm)) {
          // @ts-ignore
          schema.schemaOptions.conduit!.permissions![perm] =
            defaultPermissions[perm as keyof typeof defaultPermissions];
        }
      });
    }
    return schema;
  }
}
