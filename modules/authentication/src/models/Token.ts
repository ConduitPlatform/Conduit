import {ConduitSchema, TYPE} from "@conduit/grpc-sdk";

export const Token = new ConduitSchema('Token',
  {
    _id: TYPE.ObjectId,
    type: {
      type: TYPE.String,
      systemRequired: true
    },
    userId: {
      type: TYPE.Relation,
      model: 'User',
      systemRequired: true
    },
    token: {
      type: TYPE.String,
      systemRequired: true
    },
    data: {
      type: TYPE.JSON,
      systemRequired: true
    },
    createdAt: TYPE.Date,
    updatedAt: TYPE.Date
  },
  {
    timestamps: true,
    systemRequired: true
  });
