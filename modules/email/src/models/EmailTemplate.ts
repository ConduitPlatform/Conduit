import {ConduitSchema, TYPE} from "@conduit/grpc-sdk";


export const emailTemplateSchema = new ConduitSchema('EmailTemplate',
    {
        _id: TYPE.ObjectId,
        name: {
            type: TYPE.String,
            unique: true,
            required: true,
        systemRequired: true},
        subject: {
            type: TYPE.String,
      systemRequired: true
        },
        body: {
            type: TYPE.String,
            required: true,
        systemRequired: true},
        variables: {
            type: [TYPE.String],
        systemRequired: true},
        createdAt:  TYPE.Date,

        updatedAt: TYPE.Date
            },
        {
    timestamps: true,
    systemRequired: true
    });
