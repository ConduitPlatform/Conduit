import { ConduitSchema, TYPE } from '@conduit/sdk';

export const AccessTokenSchema = new ConduitSchema('AccessToken',
  {
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
    }
  },
  {
    timestamps: true
  });
