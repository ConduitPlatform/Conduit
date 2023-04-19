import { SQLSchema } from './SQLSchema';
import { schemaConverter } from './SchemaConverter';
import { ConduitSchema, Indexable } from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash';
import { ConduitDatabaseSchema } from '../../../interfaces';
import { SequelizeAdapter } from '../index';
import { compileSchema, resolveRelatedSchemas } from '../utils';

export class SQLAdapter extends SequelizeAdapter<SQLSchema> {
  constructor(connectionUri: string) {
    super(connectionUri);
  }

  async deleteSchema(
    schemaName: string,
    deleteData: boolean,
    callerModule: string = 'database',
    instanceSync = false,
  ): Promise<string> {
    if (instanceSync) {
      for (const association in this.models[schemaName].associations) {
        const associationSchema = this.models[schemaName].associations[association];
        if (Array.isArray(associationSchema)) {
          delete this.models[associationSchema[0].schema.name];
        } else {
          delete this.models[associationSchema.schema.name];
        }
      }
      return await super.deleteSchema(schemaName, deleteData, callerModule, instanceSync);
    } else if (deleteData) {
      for (const association in this.models[schemaName].associations) {
        const associationSchema = this.models[schemaName].associations[association];
        if (Array.isArray(associationSchema)) {
          delete this.models[associationSchema[0].schema.name];
          await associationSchema[0].model.drop();
        } else {
          delete this.models[associationSchema.schema.name];
          await associationSchema.model.drop();
        }
      }
      return await super.deleteSchema(schemaName, deleteData, callerModule, instanceSync);
    }
    return await super.deleteSchema(schemaName, deleteData, callerModule, instanceSync);
  }

  getDatabaseType(): string {
    return 'PostgreSQL';
  }

  protected async hasLegacyCollections() {
    return false;
  }

  protected async _createSchemaFromAdapter(
    schema: ConduitDatabaseSchema,
    saveToDb: boolean = true,
    options?: { parentSchema: string },
  ): Promise<SQLSchema> {
    const compiledSchema = compileSchema(
      schema,
      this.registeredSchemas,
      this.sequelize.models,
    );

    const [newSchema, extractedSchemas, extractedRelations] =
      schemaConverter(compiledSchema);
    this.registeredSchemas.set(
      schema.name,
      Object.freeze(JSON.parse(JSON.stringify(schema))),
    );
    const relatedSchemas = await resolveRelatedSchemas(
      schema,
      extractedRelations,
      this.models,
    );
    const associatedSchemas: { [key: string]: SQLSchema | SQLSchema[] } = {};
    await this.processExtractedSchemas(schema, extractedSchemas, associatedSchemas);
    if (options && options.parentSchema) {
      schema.parentSchema = options.parentSchema;
    }
    this.models[schema.name] = new SQLSchema(
      this.sequelize,
      newSchema,
      schema,
      this,
      relatedSchemas,
      associatedSchemas,
    );

    const noSync = this.models[schema.name].originalSchema.modelOptions.conduit!.noSync;
    // do not sync extracted schemas
    if ((isNil(noSync) || !noSync) && !options) {
      await this.models[schema.name].sync();
    }
    // do not store extracted schemas to db
    if (!options && saveToDb) {
      await this.compareAndStoreMigratedSchema(schema);
      await this.saveSchemaToDatabase(schema);
      if (associatedSchemas && Object.keys(associatedSchemas).length > 0) {
        for (const associatedSchema in associatedSchemas) {
          const schema = associatedSchemas[associatedSchema];
          if (Array.isArray(schema)) {
            await this.saveSchemaToDatabase(schema[0].originalSchema);
          } else {
            await this.saveSchemaToDatabase(schema.originalSchema);
          }
        }
      }
    }
    return this.models[schema.name];
  }

  private async processExtractedSchemas(
    schema: ConduitSchema,
    extractedSchemas: Indexable,
    associatedSchemas: { [key: string]: SQLSchema | SQLSchema[] },
  ) {
    for (const extractedSchema in extractedSchemas) {
      const modelOptions = {
        ...schema.modelOptions,
        permissions: {
          extendable: false,
          canCreate: false,
          canModify: 'Nothing',
          canDelete: false,
        },
      };
      let modeledSchema;
      let isArray = false;
      if (Array.isArray(extractedSchemas[extractedSchema])) {
        isArray = true;
        modeledSchema = new ConduitSchema(
          `${schema.name}_${extractedSchema}`,
          extractedSchemas[extractedSchema][0],
          modelOptions,
          `${schema.collectionName}_${extractedSchema}`,
        );
      } else {
        modeledSchema = new ConduitSchema(
          `${schema.name}_${extractedSchema}`,
          extractedSchemas[extractedSchema],
          modelOptions,
          `${schema.collectionName}_${extractedSchema}`,
        );
      }

      modeledSchema.ownerModule = schema.ownerModule;
      (modeledSchema as ConduitDatabaseSchema).compiledFields = modeledSchema.fields;
      // check index compatibility
      const sequelizeSchema = await this._createSchemaFromAdapter(
        modeledSchema as ConduitDatabaseSchema,
        false,
        {
          parentSchema: schema.name,
        },
      );
      associatedSchemas[extractedSchema] = isArray ? [sequelizeSchema] : sequelizeSchema;
    }
  }
}
