import { ConduitSchema, GrpcError } from '@conduitplatform/grpc-sdk';
import { MultiDocQuery, SchemaAdapter } from '../interfaces';
import { validateExtensionFields } from './utils/extensions';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash';

export abstract class DatabaseAdapter<T extends SchemaAdapter<any>> {
  registeredSchemas: Map<string, ConduitSchema>;
  models?: { [name: string]: T };

  /**
   * Checks if the database adapter includes the declaredSchema model
   */
  abstract isConduitDB(): Promise<boolean>;

  /**
   * 
   * Introspects all schemas of current db connection, registers them to conduit
   */
  abstract introspectDatabase(isConduitDB : boolean): Promise<ConduitSchema[]>;

  /**
   * Should accept a JSON schema and output a .ts interface for the adapter
   * @param schema
   */
  abstract createSchemaFromAdapter(schema: ConduitSchema): Promise<SchemaAdapter<any>>;

  async createCustomSchemaFromAdapter(schema: ConduitSchema) {
    schema.ownerModule = 'database';
    return this.createSchemaFromAdapter(schema);
  }

  /**
   * Given a schema name, returns the schema adapter assigned
   * @param schemaName
   */
  getSchema(schemaName: string): ConduitSchema {
    if (this.models && this.models![schemaName]) {
      return this.models[schemaName].originalSchema;
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

  abstract deleteSchema(schemaName: string, deleteData: boolean, callerModule: string): Promise<string>;

  async getBaseSchema(schemaName: string): Promise<ConduitSchema> {
    if (this.models && this.models![schemaName]) {
      const schema = this.models[schemaName].originalSchema;
      return this.models['_DeclaredSchema'].findOne(
        JSON.stringify({ name: schemaName }),
        undefined,
        undefined,
      ).then((unstitched) => {
        (schema.fields as any) = unstitched.fields;
        return schema;
      });
    } else {
      throw new GrpcError(status.NOT_FOUND, `Schema ${schemaName} not defined yet`);
    }
  }

  abstract getSchemaModel(
    schemaName: string
  ): { model: SchemaAdapter<any>; relations: any };

  fixDatabaseSchemaOwnership(schema: ConduitSchema) {
    const dbSchemas = ['CustomEndpoints','_PendingSchemas'];
    if (dbSchemas.includes(schema.name)) {
      schema.ownerModule = 'database';
    }
  }

  async checkModelOwnership(schema: ConduitSchema) {
    this.fixDatabaseSchemaOwnership(schema);
    if (schema.name === '_DeclaredSchema') return true;

    const model = await this.models!['_DeclaredSchema'].findOne( JSON.stringify({ name: schema.name }));
    if (model && ((model.ownerModule === schema.ownerModule) || (model.ownerModule === 'cms'))) {
      return true;
    } else if (model) {
      return false;
    }
    return true;
  }

  protected async saveSchemaToDatabase(schema: ConduitSchema) {
    if (schema.name === '_DeclaredSchema') return;

    const model = await this.models!['_DeclaredSchema'].findOne(JSON.stringify({name:schema.name}));
    if (model) {
      await this.models!['_DeclaredSchema']
        .findByIdAndUpdate(
          model._id,
          JSON.stringify({
            name: schema.name,
            fields: schema.fields,
            modelOptions: schema.schemaOptions,
            ownerModule: schema.ownerModule,
            extensions: (schema as any).extensions,
          }),
            true
        );
    } else {
      await this.models!['_DeclaredSchema']
        .create( JSON.stringify({
          name: schema.name,
          fields: schema.fields,
          modelOptions: schema.schemaOptions,
          ownerModule: schema.ownerModule,
          extensions: (schema as any).extensions,
        }));
    }
  }

  async recoverSchemasFromDatabase(): Promise<any> {
    let models: any = await this.models!['_DeclaredSchema'].findMany('{}');
    models = models
      .map((model: any) => {
        let schema = new ConduitSchema(
          model.name,
          model.fields,
          model.modelOptions
        );
        schema.ownerModule = model.ownerModule;
        (schema as any).extensions = model.extensions;
        return schema;
      })
      .map((model: ConduitSchema) => {
        return this.createSchemaFromAdapter(model);
      });

    await Promise.all(models);
  }

  abstract ensureConnected(): Promise<any>;

  setSchemaExtension(
    schema: ConduitSchema,
    extOwner: string,
    extFields: ConduitSchema['fields']
  ): Promise<SchemaAdapter<any>> {
    if (!schema.schemaOptions.conduit ||
        !schema.schemaOptions.conduit.permissions ||
        !schema.schemaOptions.conduit.permissions.extendable
    ) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Schema is not extendable');
    }
    validateExtensionFields(schema, extFields, extOwner);
    if (!(schema as any).extensions) {
      (schema as any).extensions = [];
    }
    const extIndex = (schema as any).extensions.findIndex((ext: any) => ext.ownerModule === extOwner);
    if (extIndex === -1) {
      // Create Extension
      if (Object.keys(extFields).length === 0) {
        throw new GrpcError(status.INVALID_ARGUMENT, 'Could not create schema extension with no custom fields');
      }
      (schema as any).extensions.push({
        fields: extFields,
        ownerModule: extOwner,
        createdAt: new Date(), // TODO FORMAT
        updatedAt: new Date(), // TODO FORMAT
      });
    } else {
      if (Object.keys(extFields).length === 0) {
        // Remove Extension
        (schema as any).extensions.splice(extIndex, 1);
      } else {
        // Update Extension
        (schema as any).extensions[extIndex].fields = extFields;
        (schema as any).extensions[extIndex].updatedAt = new Date(); // TODO FORMAT
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
      Object.keys(defaultPermissions).forEach((perm) => {
        if (!schema.schemaOptions.conduit!.permissions!.hasOwnProperty(perm)) {
          // @ts-ignore
          schema.schemaOptions.conduit!.permissions![perm] = defaultPermissions[perm as keyof typeof defaultPermissions];
        }
      });
    }
    return schema;
  }
}
