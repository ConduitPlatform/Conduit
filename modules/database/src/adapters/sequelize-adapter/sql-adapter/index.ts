import { SQLSchema } from './SQLSchema';
import { schemaConverter } from './SchemaConverter';
import { ConduitSchema, sleep } from '@conduitplatform/grpc-sdk';
import { validateFieldChanges, validateFieldConstraints } from '../../utils';
import { isNil } from 'lodash';
import { ConduitDatabaseSchema } from '../../../interfaces';
import { SequelizeAdapter } from '../index';
import { SequelizeSchema } from '../SequelizeSchema';

export class SQLAdapter extends SequelizeAdapter<SQLSchema> {
  constructor(connectionUri: string) {
    super(connectionUri);
  }

  protected async hasLegacyCollections() {
    return false;
  }

  private async processExtractedSchemas(
    schema: ConduitSchema,
    extractedSchemas: { [key: string]: any },
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
      const sequelizeSchema = await this._createSchemaFromAdapter(modeledSchema, {
        parentSchema: schema.name,
      });
      associatedSchemas[extractedSchema] = isArray ? [sequelizeSchema] : sequelizeSchema;
    }
  }

  protected async _createSchemaFromAdapter(
    schema: ConduitSchema,
    options?: { parentSchema: string },
  ): Promise<SQLSchema> {
    let compiledSchema = JSON.parse(JSON.stringify(schema));
    validateFieldConstraints(compiledSchema);
    (compiledSchema as any).fields = JSON.parse(
      JSON.stringify((schema as ConduitDatabaseSchema).compiledFields),
    );
    if (this.registeredSchemas.has(compiledSchema.name)) {
      if (compiledSchema.name !== 'Config') {
        compiledSchema = validateFieldChanges(
          this.registeredSchemas.get(compiledSchema.name)!,
          compiledSchema,
        );
      }
      delete this.sequelize.models[compiledSchema.collectionName];
    }

    const [newSchema, extractedSchemas, extractedRelations] =
      schemaConverter(compiledSchema);
    this.registeredSchemas.set(
      schema.name,
      Object.freeze(JSON.parse(JSON.stringify(schema))),
    );
    const relatedSchemas: { [key: string]: SequelizeSchema | SequelizeSchema[] } = {};

    if (Object.keys(extractedRelations).length > 0) {
      let pendingModels: string[] = [];
      for (const relation in extractedRelations) {
        const rel = Array.isArray(extractedRelations[relation])
          ? (extractedRelations[relation] as any[])[0]
          : extractedRelations[relation];
        if (!this.models[rel.model]) {
          if (!pendingModels.includes(rel.model)) {
            pendingModels.push(rel.model);
          }
          if (Array.isArray(extractedRelations[relation])) {
            relatedSchemas[relation] = [rel.model];
          } else {
            relatedSchemas[relation] = rel.model;
          }
        } else {
          if (Array.isArray(extractedRelations[relation])) {
            relatedSchemas[relation] = [this.models[rel.model]];
          } else {
            relatedSchemas[relation] = this.models[rel.model];
          }
        }
      }
      while (pendingModels.length > 0) {
        await sleep(500);
        pendingModels = pendingModels.filter(model => {
          if (!this.models[model]) {
            return true;
          } else {
            for (const schema in relatedSchemas) {
              // @ts-ignore
              let simple = Array.isArray(relatedSchemas[schema])
                ? (relatedSchemas[schema] as SequelizeSchema[])[0]
                : relatedSchemas[schema];
              // @ts-ignore
              if (simple === model) {
                relatedSchemas[schema] = Array.isArray(relatedSchemas[schema])
                  ? [this.models[model]]
                  : this.models[model];
              }
            }
          }
        });
      }
    }
    const associatedSchemas: { [key: string]: SQLSchema | SQLSchema[] } = {};
    await this.processExtractedSchemas(schema, extractedSchemas, associatedSchemas);
    if (options?.parentSchema) {
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
    if (!options) {
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
}
