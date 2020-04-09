import { ConduitSchema, TYPE } from '@conduit/sdk';

export const emailTemplateSchema = new ConduitSchema('EmailTemplate',
  {
    name: {
      type: TYPE.String,
      unique: true,
      required: true
    },
    subject: {
      type: TYPE.String
    },
    body: {
      type: TYPE.String,
      required: true
    },
    variables: {
      type: [String]
    }
  },
  {
    timestamps: true
  });
