import { ConduitSchema, TYPE } from '@conduit/sdk';


const schema = new ConduitSchema('SchemaDefinitions', {
        _id: TYPE.ObjectId,
        name: {
            type: TYPE.String,
            unique: true,
            required: true,
            systemRequired: true
        },
        fields: {
            type: TYPE.JSON,
            required: true,
            systemRequired: true
        },
        //todo The properties in JSON, replace adequetly
        modelOptions: { type: TYPE.String, systemRequired: true },
        enabled: {
          type: TYPE.Boolean,
          default: true,
          systemRequired: true
        },
        createdAt: TYPE.Date,
        updatedAt: TYPE.Date
    }, {
        timestamps: true,
        systemRequired: true
    }
);
export default schema;
