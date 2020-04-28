import { ConduitSchema, TYPE } from '@conduit/sdk';


const schema = new ConduitSchema('SchemaDefinitions', {
        _id: TYPE.ObjectId,
        name: {
            type: TYPE.String,
            unique: true,
            required: true
        },
        //todo The properties in JSON, replace adequetly
        fields: {
            type: TYPE.JSON,
            required: true
        },
        //todo The properties in JSON, replace adequetly
        modelOptions: TYPE.String,
        enabled: {
          type: TYPE.Boolean,
          default: true
        },
        createdAt: {
          type: TYPE.Date,
          required: true
        },
        updatedAt: {
          type: TYPE.Date,
          required: true
        }
    }, {
        timestamps: true
    }
);
export default schema;
