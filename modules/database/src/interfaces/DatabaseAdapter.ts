import { ConduitSchema } from '@quintessential-sft/conduit-grpc-sdk';
import { SchemaAdapter } from './SchemaAdapter';
import { SequelizeSchema } from '../adapters/sequelize-adapter/SequelizeSchema';

export interface DatabaseAdapter {
  registeredSchemas: Map<string, ConduitSchema>;

  /**
   * Should accept a JSON schema and output a .ts interface for the adapter
   * @param schema
   */
  createSchemaFromAdapter(schema: ConduitSchema): Promise<SchemaAdapter<any>>;

  /**
   * Given a schema name, returns the schema adapter assigned
   * @param schemaName
   */
  getSchema(schemaName: string): ConduitSchema;

  getSchemas(): ConduitSchema[];

  getSchemaModel(schemaName: string): { model: SchemaAdapter<any>; relations: any };

  recoverSchemasFromDatabase(): Promise<any>;

  ensureConnected(): Promise<any>;
}
