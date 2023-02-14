import { PostgresSchema } from './PostgresSchema';
import { schemaConverter } from './SchemaConverter';
import { ConduitSchema, sleep } from '@conduitplatform/grpc-sdk';
import { validateFieldChanges, validateFieldConstraints } from '../../utils';
import { isNil } from 'lodash';
import { ConduitDatabaseSchema } from '../../../interfaces';
import { SequelizeAdapter } from '../index';
import { SequelizeSchema } from '../SequelizeSchema';

const sqlSchemaName = process.env.SQL_SCHEMA ?? 'public';

export class PostgresAdapter extends SequelizeAdapter<PostgresSchema> {
  constructor(connectionUri: string) {
    super(connectionUri);
  }

  protected async hasLegacyCollections() {
    const res = await this.sequelize
      .query(
        `SELECT EXISTS (
    SELECT FROM 
        information_schema.tables 
    WHERE 
        table_schema LIKE '${sqlSchemaName}' AND 
        table_type LIKE 'BASE TABLE' AND
        table_name = '_DeclaredSchema'
    );`,
      )
      .then(r => (r[0][0] as { exists: boolean }).exists);
    return res;
  }

  getCollectionName(schema: ConduitSchema) {
    return schema.collectionName && schema.collectionName !== ''
      ? schema.collectionName
      : schema.name;
  }

  protected async _createSchemaFromAdapter(
    schema: ConduitSchema,
  ): Promise<PostgresSchema> {
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

    const [newSchema, extractedRelations] = schemaConverter(compiledSchema);
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
        if (!this.models[rel.model] || !this.models[rel.model].synced) {
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
          if (!this.models[model] || !this.models[model].synced) {
            return true;
          } else {
            for (const schema in relatedSchemas) {
              // @ts-ignore
              const simple = Array.isArray(relatedSchemas[schema])
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
    this.models[schema.name] = new PostgresSchema(
      this.sequelize,
      newSchema,
      schema,
      this,
      relatedSchemas,
    );

    const noSync = this.models[schema.name].originalSchema.modelOptions.conduit!.noSync;
    if (isNil(noSync) || !noSync) {
      await this.models[schema.name].sync();
    }
    await this.compareAndStoreMigratedSchema(schema);
    await this.saveSchemaToDatabase(schema);

    return this.models[schema.name];
  }

  getDatabaseType(): string {
    return 'PostgreSQL';
  }
}
