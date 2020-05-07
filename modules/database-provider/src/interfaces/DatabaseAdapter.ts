import {SchemaAdapter} from "./SchemaAdapter";

export interface DatabaseAdapter {

    /**
     * Should accept a JSON schema and output a .ts interface for the adapter
     * @param schema
     */
    createSchemaFromAdapter(schema: string): SchemaAdapter; // TODO schema type string for now since there's no ConduitSchema outside of the sdk

    /**
     * Given a schema name, returns the schema adapter assigned
     * @param schemaName
     */
    getSchema(schemaName: string): SchemaAdapter


}
