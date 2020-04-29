import { ConduitSchema, TYPE } from '@conduit/sdk';

export const AccessTokenSchema = new ConduitSchema('AccessToken',
  {
    _id: TYPE.ObjectId,
    userId: {
      type: TYPE.Relation,
      model: 'User'
    },
    clientId: {
      type: TYPE.String,
      required: true
    },
    token: {
      type: TYPE.String
    },
    expiresOn: {
      type: TYPE.Date
    },
    createdAt: TYPE.Date,
    updatedAt: TYPE.Date
  },
  {
    timestamps: true
  });
