import {SchemaAdapter} from "./SchemaAdapter";
import {ConduitSchema} from "../../../models";

export abstract class IConduitDatabase {

    constructor(dbType: string, databaseUrl: any) {
    }

    /**
     * Should accept a JSON schema and output a .ts interface for the adapter
     * @param schema
     */
    abstract createSchemaFromAdapter(schema: ConduitSchema): SchemaAdapter;

    /**
     * Given a schema name, returns the schema adapter assigned
     * @param schemaName
     */
    abstract getSchema(schemaName: string): SchemaAdapter
}
