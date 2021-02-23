import { ConduitSchema } from '@quintessential-sft/conduit-grpc-sdk';

export interface DatabaseAdapter {
  registeredSchemas: Map<string, ConduitSchema>;

  /**
   * Should accept a JSON schema and output a .ts interface for the adapter
   * @param schema
   */
  createSchemaFromAdapter(schema: any): Promise<{ schema: any }>;

  /**
   * Given a schema name, returns the schema adapter assigned
   * @param schemaName
   */
  getSchema(schemaName: string): Promise<{ schema: any }>;

  getSchemaModel(schemaName: string): Promise<{ model: any }>;

  ensureConnected(): Promise<any>;
}
