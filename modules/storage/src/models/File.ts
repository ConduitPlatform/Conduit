import { ConduitSchema, TYPE } from '@conduit/sdk';

export default new ConduitSchema(
  'File',
  {
    _id: TYPE.ObjectId,
    user: {
      type: TYPE.Relation,
      required: true,
      model: 'User',
      systemRequired: true
    },
    name: {
      type: TYPE.String,
      required: true,
      systemRequired: true
    },
    folder: {
      type: TYPE.String,
      required: true,
      systemRequired: true
    },
    mimeType: { type: TYPE.String, systemRequired: true },
    createdAt: TYPE.Date,
    updatedAt: TYPE.Date
  },
  {
    timestamps: true,
    systemRequired: true
  }
);
