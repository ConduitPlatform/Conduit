import { ConduitSchema, PlatformTypesEnum, TYPE } from '@conduit/sdk';

export const ClientModel = new ConduitSchema('Client',
  {
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
    }
  },
  {
    timestamps: true
  });
