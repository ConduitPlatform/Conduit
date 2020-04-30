import { ConduitSchema, TYPE } from '@conduit/sdk';


const schema = new ConduitSchema('SchemaDefinitions', {
        _id: TYPE.ObjectId,
        name: {
            type: TYPE.String,
            unique: true,
            required: true
        },
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
        createdAt: TYPE.Date,
        updatedAt: TYPE.Date
    }, {
        timestamps: true,
        systemRequired: true
    }
);
export default schema;
