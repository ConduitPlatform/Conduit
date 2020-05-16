import {ConduitSchema, TYPE} from "@conduit/grpc-sdk";

export default new ConduitSchema(
    'File',
    {
        name: {
            type: TYPE.String,
            required: true
        },
        folder: {
            type: TYPE.String,
            required: true
        },
        mimeType: TYPE.String
    },
    {
        timestamps: true
    }
);
