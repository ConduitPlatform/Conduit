import { ConduitSchema, TYPE } from '@conduit/sdk';

export const Token = new ConduitSchema('Token',
  {
    _id: TYPE.ObjectId,
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
    },
    createdAt: TYPE.Date,
    updatedAt: TYPE.Date
  },
  {
    timestamps: true,
    systemRequired: true
  });
