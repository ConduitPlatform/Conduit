import { ConduitSchema, TYPE } from '@conduit/sdk';

export const AdminSchema = new ConduitSchema('Admin',
  {
    _id: TYPE.ObjectId,
    username: {
      type: TYPE.String,
      required: true
    },
    password: {
      type: TYPE.String,
      required: true
    },
    createdAt: {
      type: TYPE.Date,
      required: true
    },
    updatedAt: {
      type: TYPE.Date,
      required: true
    }
  },{timestamps: true});
