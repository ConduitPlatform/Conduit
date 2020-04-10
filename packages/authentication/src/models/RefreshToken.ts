import { ConduitSchema, TYPE } from '@conduit/sdk';

export const RefreshTokenSchema = new ConduitSchema('RefreshToken',
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
    },
    securityDetails: {
      macAddress: TYPE.String,
      userAgent: TYPE.String
    }
  },
  {
    timestamps: true
  });
