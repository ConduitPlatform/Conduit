import {ConduitSchema, TYPE} from "@conduit/sdk";


const schema = new ConduitSchema('SchemaDefinitions', {
        name: {
            type: TYPE.String,
        },
        //todo The properties in JSON, replace adequetly
        modelSchema: {
            type: TYPE.String
        },
        //todo The properties in JSON, replace adequetly
        modelOptions: TYPE.String
    }, {
        timestamps: true
    }
);
export default schema;
