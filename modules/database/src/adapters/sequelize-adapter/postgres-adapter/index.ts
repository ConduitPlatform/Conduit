import { PostgresSchema } from './PostgresSchema';
import { schemaConverter } from './SchemaConverter';
import { ConduitModel, ConduitSchema, Indexable, sleep } from '@conduitplatform/grpc-sdk';
import { validateSchema } from '../../utils/validateSchema';
import { sqlSchemaConverter } from '../../../introspection/sequelize/utils';
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

  async introspectSchema(table: Indexable, originalName: string): Promise<ConduitSchema> {
    sqlSchemaConverter(table);

    await this.sequelize.query(
      `ALTER TABLE ${sqlSchemaName}.${originalName} ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP DEFAULT NOW()`,
    );
    await this.sequelize.query(
      `ALTER TABLE ${sqlSchemaName}.${originalName} ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP DEFAULT NOW()`,
    );

    const schema = new ConduitSchema(originalName, table as ConduitModel, {
      timestamps: true,
      conduit: {
        noSync: true,
        permissions: {
          extendable: false,
          canCreate: false,
          canModify: 'Nothing',
          canDelete: false,
        },
        cms: {
          authentication: false,
          crudOperations: {
            create: {
              enabled: false,
              authenticated: false,
            },
            read: {
              enabled: false,
              authenticated: false,
            },
            update: {
              enabled: false,
              authenticated: false,
            },
            delete: {
              enabled: false,
              authenticated: false,
            },
          },
          enabled: true,
        },
      },
    });
    schema.ownerModule = 'database';

    return schema;
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
    (compiledSchema as any).fields = JSON.parse(
      JSON.stringify((schema as ConduitDatabaseSchema).compiledFields),
    );
    if (this.registeredSchemas.has(compiledSchema.name)) {
      if (compiledSchema.name !== 'Config') {
        compiledSchema = validateSchema(
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
