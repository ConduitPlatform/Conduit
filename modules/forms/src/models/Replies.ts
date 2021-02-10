import {ConduitSchema, TYPE} from '@quintessential-sft/conduit-grpc-sdk';

export const RepliesSchema = new ConduitSchema('FormReplies',
    {
        _id: TYPE.ObjectId,
        form: {
            type: TYPE.Relation,
            model: 'Forms',
            required: true,
            systemRequired: true
        },
        data: {
            type: TYPE.JSON,
            required: true,
            systemRequired: true
        },
        possibleSpam: {
            type: TYPE.Boolean,
            default:false
        },
        createdAt: TYPE.Date,
        updatedAt: TYPE.Date
    },
    {
        timestamps: true,
        systemRequired: true
    });
