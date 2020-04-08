import { PlatformTypesEnum } from '../PlatformTypesEnum';

export const ClientModel = {
  name: 'Client',
  modelSchema: {
    clientId: {
      type: String,
      unique: true,
      required: true
    },
    clientSecret: {
      type: String,
      required: true
    },
    platform: {
      type: String,
      enum: Object.values(PlatformTypesEnum),
      required: true
    }
  },
  modelOptions: {
    timestamps: true
  }
};
