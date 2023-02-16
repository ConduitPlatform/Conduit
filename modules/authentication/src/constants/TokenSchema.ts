import { TYPE } from '@conduitplatform/grpc-sdk';

export const userTokenSchema = {
  user: {
    type: TYPE.Relation,
    model: 'User',
    required: true,
  },
  clientId: {
    type: TYPE.String,
    required: false,
  },
  token: {
    type: TYPE.String,
    required: true,
  },
  expiresOn: {
    type: TYPE.Date,
    required: true,
  },
};
