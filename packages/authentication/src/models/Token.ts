import { ConduitSchema, TYPE } from '@conduit/sdk';

export const Token = new ConduitSchema('Token',
  {
    type: {
      type: TYPE.String,
    },
    userId: {
      type: TYPE.Relation,
      model: 'User'
    },
    token: {
      type: TYPE.String
    },
    data: {
      type: TYPE.JSON
    }
  },
  {
    timestamps: true
  });
