import {ConduitSchema, TYPE} from '@quintessential-sft/conduit-grpc-sdk';


const schema = new ConduitSchema('CustomEndpoint', {
        _id: TYPE.ObjectId,
        name: {
            type: TYPE.String,
            unique: true,
            required: true
        },
        operation: {
            type: TYPE.Number,
            required: true
        },
        selectedSchema: {
            type: TYPE.ObjectId,
            required: true
        },
        inputs: {
            type: TYPE.JSON,
            required: true
        },
        queries: {
            type: TYPE.JSON,
            required: true
        },
        enabled: {
            type: TYPE.Boolean,
            default: true,
            systemRequired: true
        },
        createdAt: TYPE.Date,
        updatedAt: TYPE.Date
    }, {
        timestamps: true,
    }
);
export default schema;
