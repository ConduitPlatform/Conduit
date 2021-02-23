import { ConduitSchema, TYPE } from '@quintessential-sft/conduit-grpc-sdk';

export const FormsSchema = new ConduitSchema(
  'Forms',
  {
    _id: TYPE.ObjectId,
    name: {
      type: TYPE.String,
      required: true,
      unique: true,
      systemRequired: true,
    },
    fields: {
      type: TYPE.JSON,
      required: true,
      systemRequired: true,
    },
    forwardTo: {
      type: TYPE.String,
      required: true,
      systemRequired: true,
    },
    emailField: {
      type: TYPE.String,
    },
    enabled: {
      type: TYPE.Boolean,
      default: true,
    },
    createdAt: TYPE.Date,
    updatedAt: TYPE.Date,
  },
  {
    timestamps: true,
    systemRequired: true,
  }
);
