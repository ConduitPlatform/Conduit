import { PostgresSchema } from './PostgresSchema';
import { schemaConverter } from './SchemaConverter';
import { ConduitSchema } from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash';
import { ConduitDatabaseSchema } from '../../../interfaces';
import { SequelizeAdapter } from '../index';
import { compileSchema, resolveRelatedSchemas } from '../utils';

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
    saveToDb: boolean = true,
  ): Promise<PostgresSchema> {
    const compiledSchema = compileSchema(
      schema as ConduitDatabaseSchema,
      this.registeredSchemas,
      this.sequelize.models,
    );

    const [newSchema, extractedRelations] = schemaConverter(compiledSchema);
    this.registeredSchemas.set(
      schema.name,
      Object.freeze(JSON.parse(JSON.stringify(schema))),
    );
    const relatedSchemas = await resolveRelatedSchemas(
      schema as ConduitDatabaseSchema,
      extractedRelations,
      this.models,
    );
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
    if (saveToDb) {
      await this.compareAndStoreMigratedSchema(schema);
      await this.saveSchemaToDatabase(schema);
    }
    return this.models[schema.name];
  }

  getDatabaseType(): string {
    return 'PostgreSQL';
  }
}
