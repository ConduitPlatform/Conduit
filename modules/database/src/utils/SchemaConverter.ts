import { Schema as SchemaDto } from '../protoTypes/database.js';
import { ConduitDatabaseSchema } from '../interfaces/index.js';
import { DatabaseAdapter } from '../adapters/DatabaseAdapter.js';
import { MongooseSchema } from '../adapters/mongoose-adapter/MongooseSchema.js';
import { SequelizeSchema } from '../adapters/sequelize-adapter/SequelizeSchema.js';
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
    authorization?: {
      enabled?: boolean;
    };
    permissions?: {
      extendable?: boolean;
      canCreate?: boolean;
      canModify?: 'Everything' | 'Nothing' | 'ExtensionOnly';
      canDelete?: boolean;
    };
    timestamps?: boolean;
    existingModelOptions?: ConduitSchemaOptions;
    importedSchema?: boolean;
  }) {
    const modelOptions = opts.existingModelOptions ?? {};
    if (!modelOptions.conduit) modelOptions.conduit = {};
    const defaults = getDefaultModelOptions(!!opts.importedSchema);
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
            : defaults.conduit!.cms.enabled,
        crudOperations: {
          create: {
            enabled:
              explicit.cms?.crudOperations?.create?.enabled !== undefined
                ? explicit.cms.crudOperations?.create.enabled
                : existing?.cms?.crudOperations?.create?.enabled !== undefined
                ? existing.cms.crudOperations.create.enabled
                : defaults.conduit!.cms.crudOperations.create.enabled,
            authenticated:
              explicit.cms?.crudOperations?.create?.authenticated !== undefined
                ? explicit.cms.crudOperations?.create.authenticated
                : existing?.cms?.crudOperations?.create?.authenticated !== undefined
                ? existing.cms.crudOperations.create.authenticated
                : defaults.conduit!.cms.crudOperations.create.authenticated,
          },
          read: {
            enabled:
              explicit.cms?.crudOperations?.read?.enabled !== undefined
                ? explicit.cms.crudOperations?.read.enabled
                : existing?.cms?.crudOperations?.read?.enabled !== undefined
                ? existing.cms.crudOperations.read.enabled
                : defaults.conduit!.cms.crudOperations.read.enabled,
            authenticated:
              explicit.cms?.crudOperations?.read?.authenticated !== undefined
                ? explicit.cms.crudOperations?.read.authenticated
                : existing?.cms?.crudOperations?.read?.authenticated !== undefined
                ? existing.cms.crudOperations.read.authenticated
                : defaults.conduit!.cms.crudOperations.read.authenticated,
          },
          update: {
            enabled:
              explicit.cms?.crudOperations?.update?.enabled !== undefined
                ? explicit.cms.crudOperations?.update.enabled
                : existing?.cms?.crudOperations?.update?.enabled !== undefined
                ? existing.cms.crudOperations.update.enabled
                : defaults.conduit!.cms.crudOperations.update.enabled,
            authenticated:
              explicit.cms?.crudOperations?.update?.authenticated !== undefined
                ? explicit.cms.crudOperations?.update.authenticated
                : existing?.cms?.crudOperations?.update?.authenticated !== undefined
                ? existing.cms.crudOperations.update.authenticated
                : defaults.conduit!.cms.crudOperations.update.authenticated,
          },
          delete: {
            enabled:
              explicit.cms?.crudOperations?.delete?.enabled !== undefined
                ? explicit.cms.crudOperations?.delete.enabled
                : existing?.cms?.crudOperations?.delete?.enabled !== undefined
                ? existing.cms.crudOperations.delete.enabled
                : defaults.conduit!.cms.crudOperations.delete.enabled,
            authenticated:
              explicit.cms?.crudOperations?.delete?.authenticated !== undefined
                ? explicit.cms.crudOperations?.delete.authenticated
                : existing?.cms?.crudOperations?.delete?.authenticated !== undefined
                ? existing.cms.crudOperations.delete.authenticated
                : defaults.conduit!.cms.crudOperations.delete.authenticated,
          },
        },
      };
    }
    modelOptions.conduit.authorization = {
      enabled:
        opts.authorization?.enabled ??
        existing?.authorization?.enabled ??
        defaults.conduit!.authorization?.enabled ??
        false,
    };
    modelOptions.conduit.permissions = {
      extendable:
        explicit.permissions?.extendable !== undefined
          ? explicit.permissions.extendable
          : existing?.permissions?.extendable !== undefined
          ? existing.permissions.extendable
          : defaults.conduit!.permissions!.extendable,
      canCreate:
        explicit.permissions?.canCreate !== undefined
          ? explicit.permissions.canCreate
          : existing?.permissions?.canCreate !== undefined
          ? existing.permissions.canCreate
          : defaults.conduit!.permissions!.canCreate,
      canModify:
        explicit.permissions?.canModify !== undefined
          ? explicit.permissions.canModify
          : existing?.permissions?.canModify !== undefined
          ? existing.permissions.canModify
          : defaults.conduit!.permissions!.canModify,
      canDelete:
        explicit.permissions?.canDelete !== undefined
          ? explicit.permissions.canDelete
          : existing?.permissions?.canDelete !== undefined
          ? existing.permissions.canDelete
          : defaults.conduit!.permissions!.canDelete,
    };
    modelOptions.timestamps =
      opts.timestamps ?? opts.existingModelOptions?.timestamps ?? defaults.timestamps;
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
        authorization: {
          enabled: false,
        },
        permissions: {
          extendable: !importedSchema,
          canCreate: !importedSchema,
          canModify: !importedSchema ? 'Everything' : 'Nothing',
          canDelete: !importedSchema,
        },
      },
      timestamps: true,
    };
  }
}
