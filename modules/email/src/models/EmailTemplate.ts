import {ConduitSchema, TYPE} from '@conduit/sdk';

export const emailTemplateSchema = new ConduitSchema('EmailTemplate',
    {
        _id: TYPE.ObjectId,
        name: {
            type: TYPE.String,
            unique: true,
            required: true
        },
        subject: {
            type: TYPE.String
        },
        body: {
            type: TYPE.String,
            required: true
        },
        variables: {
            type: [String]
        },
        createdAt: {
            type: TYPE.Date,
            required: true
        },
        updatedAt: {
            type: TYPE.Date,
            required: true
        }
    },
    {
        timestamps: true
    });
