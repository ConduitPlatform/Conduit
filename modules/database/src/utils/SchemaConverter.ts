import { Schema as SchemaDto } from '../protoTypes/database';
import { ConduitDatabaseSchema } from '../interfaces';
import { DatabaseAdapter } from '../adapters/DatabaseAdapter';
import { MongooseSchema } from '../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../adapters/sequelize-adapter/SequelizeSchema';
import { ConduitSchemaOptions } from '@conduitplatform/grpc-sdk';

// @dirty-type-cast - Input is never technically ConduitDatabaseSchema yet

export namespace SchemaConverter {
  export function dbToGrpc(
    adapter: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
    schema: ConduitDatabaseSchema,
  ): SchemaDto {
    return {
      name: schema.name,
      fields: JSON.stringify(schema.compiledFields),
      modelOptions: JSON.stringify(schema.modelOptions),
      collectionName: schema.collectionName,
      fieldHash: adapter.models[schema.name].fieldHash,
    };
  }

  /**
   * Generates a new or updated modelOptions object.
   */
  export function getModelOptions(opts: {
    cmsSchema?: boolean; // separate field as unprovided 'cms' could indicate default values
    cms?: {
      enabled?: boolean;
      crudOperations?: {
        create?: { enabled?: boolean; authenticated?: boolean };
        read?: { enabled?: boolean; authenticated?: boolean };
        update?: { enabled?: boolean; authenticated?: boolean };
        delete?: { enabled?: boolean; authenticated?: boolean };
      };
    };
    permissions?: {
      extendable?: boolean;
      canCreate?: boolean;
      canModify?: 'Everything' | 'Nothing' | 'ExtensionOnly';
      canDelete?: boolean;
    };
    existingModelOptions?: ConduitSchemaOptions;
    importedSchema?: boolean;
  }) {
    const modelOptions = opts.existingModelOptions ?? {};
    if (!modelOptions.conduit) modelOptions.conduit = {};
    const defaults = getDefaultModelOptions(!!opts.importedSchema).conduit!;
    const existing = opts.existingModelOptions?.conduit;
    const explicit = { cms: opts.cms, permissions: opts.permissions };
    // Grab first source available: explicit -> existing -> default
    if (opts.cmsSchema) {
      modelOptions.conduit.cms = {
        enabled:
          explicit.cms?.enabled !== undefined
            ? explicit.cms.enabled
            : existing?.cms?.enabled !== undefined
            ? existing.cms.enabled
            : defaults.cms.enabled,
        crudOperations: {
          create: {
            enabled:
              explicit.cms?.crudOperations?.create?.enabled !== undefined
                ? explicit.cms.crudOperations?.create.enabled
                : existing?.cms?.crudOperations?.create?.enabled !== undefined
                ? existing.cms.crudOperations.create.enabled
                : defaults.cms.crudOperations.create.enabled,
            authenticated:
              explicit.cms?.crudOperations?.create?.authenticated !== undefined
                ? explicit.cms.crudOperations?.create.authenticated
                : existing?.cms?.crudOperations?.create?.authenticated !== undefined
                ? existing.cms.crudOperations.create.authenticated
                : defaults.cms.crudOperations.create.authenticated,
          },
          read: {
            enabled:
              explicit.cms?.crudOperations?.read?.enabled !== undefined
                ? explicit.cms.crudOperations?.read.enabled
                : existing?.cms?.crudOperations?.read?.enabled !== undefined
                ? existing.cms.crudOperations.read.enabled
                : defaults.cms.crudOperations.read.enabled,
            authenticated:
              explicit.cms?.crudOperations?.read?.authenticated !== undefined
                ? explicit.cms.crudOperations?.read.authenticated
                : existing?.cms?.crudOperations?.read?.authenticated !== undefined
                ? existing.cms.crudOperations.read.authenticated
                : defaults.cms.crudOperations.read.authenticated,
          },
          update: {
            enabled:
              explicit.cms?.crudOperations?.update?.enabled !== undefined
                ? explicit.cms.crudOperations?.update.enabled
                : existing?.cms?.crudOperations?.update?.enabled !== undefined
                ? existing.cms.crudOperations.update.enabled
                : defaults.cms.crudOperations.update.enabled,
            authenticated:
              explicit.cms?.crudOperations?.update?.authenticated !== undefined
                ? explicit.cms.crudOperations?.update.authenticated
                : existing?.cms?.crudOperations?.update?.authenticated !== undefined
                ? existing.cms.crudOperations.update.authenticated
                : defaults.cms.crudOperations.update.authenticated,
          },
          delete: {
            enabled:
              explicit.cms?.crudOperations?.delete?.enabled !== undefined
                ? explicit.cms.crudOperations?.delete.enabled
                : existing?.cms?.crudOperations?.delete?.enabled !== undefined
                ? existing.cms.crudOperations.delete.enabled
                : defaults.cms.crudOperations.delete.enabled,
            authenticated:
              explicit.cms?.crudOperations?.delete?.authenticated !== undefined
                ? explicit.cms.crudOperations?.delete.authenticated
                : existing?.cms?.crudOperations?.delete?.authenticated !== undefined
                ? existing.cms.crudOperations.delete.authenticated
                : defaults.cms.crudOperations.delete.authenticated,
          },
        },
      };
    }
    modelOptions.conduit.permissions = {
      extendable:
        explicit.permissions?.extendable !== undefined
          ? explicit.permissions.extendable
          : existing?.permissions?.extendable !== undefined
          ? existing.permissions.extendable
          : defaults.permissions!.extendable,
      canCreate:
        explicit.permissions?.canCreate !== undefined
          ? explicit.permissions.canCreate
          : existing?.permissions?.canCreate !== undefined
          ? existing.permissions.canCreate
          : defaults.permissions!.canCreate,
      canModify:
        explicit.permissions?.canModify !== undefined
          ? explicit.permissions.canModify
          : existing?.permissions?.canModify !== undefined
          ? existing.permissions.canModify
          : defaults.permissions!.canModify,
      canDelete:
        explicit.permissions?.canDelete !== undefined
          ? explicit.permissions.canDelete
          : existing?.permissions?.canDelete !== undefined
          ? existing.permissions.canDelete
          : defaults.permissions!.canDelete,
    };
    return modelOptions;
  }

  function getDefaultModelOptions(importedSchema = false): ConduitSchemaOptions {
    return {
      conduit: {
        cms: {
          enabled: !importedSchema,
          crudOperations: {
            create: {
              enabled: !importedSchema,
              authenticated: false,
            },
            read: {
              enabled: !importedSchema,
              authenticated: false,
            },
            update: {
              enabled: !importedSchema,
              authenticated: false,
            },
            delete: {
              enabled: !importedSchema,
              authenticated: false,
            },
          },
        },
        permissions: {
          extendable: !importedSchema,
          canCreate: !importedSchema,
          canModify: !importedSchema ? 'Everything' : 'Nothing',
          canDelete: !importedSchema,
        },
      },
    };
  }
}
