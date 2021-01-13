import { ConduitSchema } from '@quintessential-sft/conduit-grpc-sdk';
import { SchemaAdapter } from './SchemaAdapter';

export interface DatabaseAdapter {
  registeredSchemas: Map<string, ConduitSchema>;

  /**
   * Should accept a JSON schema and output a .ts interface for the adapter
   * @param schema
   */
  createSchemaFromAdapter(schema: ConduitSchema): Promise<SchemaAdapter>;

  /**
   * Given a schema name, returns the schema adapter assigned
   * @param schemaName
   */
  getSchema(schemaName: string): ConduitSchema;

  getSchemaModel(schemaName: string): { model: SchemaAdapter, relations: any };

  ensureConnected(): Promise<any>;
}
