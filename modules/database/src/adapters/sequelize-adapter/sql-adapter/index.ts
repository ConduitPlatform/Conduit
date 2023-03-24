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

  protected async hasLegacyCollections() {
    return false;
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

    const [newSchema, extractedRelations] = schemaConverter(compiledSchema);
    this.registeredSchemas.set(
      schema.name,
      Object.freeze(JSON.parse(JSON.stringify(schema))),
    );
    const relatedSchemas = await resolveRelatedSchemas(
      schema,
      extractedRelations,
      this.models,
    );
    if (options && options.parentSchema) {
      schema.parentSchema = options.parentSchema;
    }
    this.models[schema.name] = new SQLSchema(
      this.sequelize,
      newSchema,
      schema,
      this,
      relatedSchemas,
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
    }
    return this.models[schema.name];
  }

  async deleteSchema(
    schemaName: string,
    deleteData: boolean,
    callerModule: string = 'database',
    instanceSync = false,
  ): Promise<string> {
    return super.deleteSchema(schemaName, deleteData, callerModule, instanceSync);
  }

  getDatabaseType(): string {
    return 'PostgreSQL';
  }
}
