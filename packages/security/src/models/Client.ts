import { ConduitSchema, PlatformTypesEnum, TYPE } from '@quintessential-sft/conduit-sdk';

export const ClientModel = new ConduitSchema(
  'Client',
  {
    _id: TYPE.ObjectId,
    clientId: {
      type: TYPE.String,
      unique: true,
      required: true,
      systemRequired: true,
    },
    clientSecret: {
      type: TYPE.String,
      required: true,
      select: false,
      systemRequired: true,
    },
    platform: {
      type: TYPE.String,
      enum: Object.values(PlatformTypesEnum),
      required: true,
      systemRequired: true,
    },
    createdAt: TYPE.Date,
    updatedAt: TYPE.Date,
  },
  {
    timestamps: true,
    systemRequired: true,
  }
);
