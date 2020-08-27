import {ConduitSchema, TYPE} from '@quintessential-sft/conduit-grpc-sdk';

export const AccessTokenSchema = new ConduitSchema('AccessToken',
  {
    _id: TYPE.ObjectId,
    userId: {
      type: TYPE.Relation,
      model: 'User',
      systemRequired: true
    },
    clientId: {
      type: TYPE.String,
      required: true,
      systemRequired: true
    },
    token: {
      type: TYPE.String,
      systemRequired: true
    },
    expiresOn: {
      type: TYPE.Date,
      systemRequired: true
    },
    createdAt: TYPE.Date,
    updatedAt: TYPE.Date
  },
  {
    timestamps: true,
    systemRequired: true
  });
