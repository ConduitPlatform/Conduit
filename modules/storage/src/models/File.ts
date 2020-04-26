import { ConduitSchema, TYPE } from '@conduit/sdk';

export default new ConduitSchema(
  'File',
  {
    user: {
      type: TYPE.Relation,
      required: true,
      model: 'User'
    },
    name: {
      type: TYPE.String,
      required: true
    },
    folder: {
      type: TYPE.String,
      required: true
    },
    mimeType: TYPE.String
  },
  {
    timestamps: true
  }
);
