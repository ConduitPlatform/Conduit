import { ConduitSchema, TYPE } from '@conduit/sdk';


const schema = new ConduitSchema('SchemaDefinitions', {
        name: {
            type: TYPE.String,
        },
        //todo The properties in JSON, replace adequetly
        modelSchema: {
            type: TYPE.String
        },
        //todo The properties in JSON, replace adequetly
        modelOptions: TYPE.String,
        enabled: {
          type: TYPE.Boolean,
          default: true
        }
    }, {
        timestamps: true
    }
);
export default schema;
