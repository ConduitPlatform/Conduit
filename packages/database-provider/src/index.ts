import {MongooseAdapter} from "./adapters/mongoose-adapter";
import {DatabaseAdapter, IConduitDatabase, SchemaAdapter} from "@conduit/sdk";


export class ConduitDefaultDatabase extends IConduitDatabase {

    private readonly _activeAdapter: DatabaseAdapter;

    constructor(dbType: string, databaseUrl: any) {
        super(dbType, databaseUrl);
        if (dbType === 'mongodb') {
            this._activeAdapter = new MongooseAdapter(databaseUrl);
        } else {
            throw new Error("Arguments not supported")
        }
    }

    /**
     * Should accept a JSON schema and output a .ts interface for the adapter
     * @param schema
     */
    createSchemaFromAdapter(schema: any): SchemaAdapter {
        return this._activeAdapter.createSchemaFromAdapter(schema);
    }

    /**
     * Given a schema name, returns the schema adapter assigned
     * @param schemaName
     */
    getSchema(schemaName: string): SchemaAdapter {
        return this._activeAdapter.getSchema(schemaName);
    }
}

