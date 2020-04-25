import {ConduitSchema, ConduitSDK, SchemaAdapter} from "../../index";

export abstract class IConduitCMS {

    constructor(sd: ConduitSDK) {
    }

    abstract createSchema(schema: ConduitSchema): void;

    abstract constructSchemaRoutes(schema: SchemaAdapter): void;
}
