import {SchemaAdapter} from "./SchemaAdapter";

export interface DatabaseAdapter {

    /**
     * Should accept a JSON schema and output a .ts interface for the adapter
     * @param schema
     */
    createSchemaFromAdapter(schema: any): SchemaAdapter;

    /**
     * Given a schema name, returns the schema adapter assigned
     * @param schemaName
     */
    getSchema(schemaName: string): SchemaAdapter


}
