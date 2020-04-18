import { ConduitSchema, PlatformTypesEnum, TYPE } from '@conduit/sdk';

export const ClientModel = new ConduitSchema('Client',
  {
    _id: TYPE.ObjectId,
    clientId: {
      type: TYPE.String,
      unique: true,
      required: true
    },
    clientSecret: {
      type: TYPE.String,
      required: true
    },
    platform: {
      type: TYPE.String,
      enum: Object.values(PlatformTypesEnum),
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
  },
  {
    timestamps: true
  });
