import { ConduitSchema, TYPE } from '@quintessential-sft/conduit-grpc-sdk';

export const ServiceSchema = new ConduitSchema('Service',
  {
    _id: TYPE.ObjectId,
    name: {
      type: TYPE.String,
      unique: true,
      required: true,
      systemRequired: true
    },
    hashedToken: {
      type: TYPE.String,
      systemRequired: true
    },
    active: {
      type: TYPE.Boolean,
      default: true,
      systemRequired: true
    },
    createdAt: TYPE.Date,
    updatedAt: TYPE.Date
  },
  {
    timestamps: true,
    systemRequired: true
  });
