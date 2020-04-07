import { PlatformTypesEnum } from '../../../security/src/PlatformTypesEnum';

export const NotificationTokenModel = {
  name: 'NotificationToken',
  modelSchema: {
    userId: {
      type: 'Relation',
      model: 'User'
    },
    token: {
      type: String,
      required: true
    },
    platform: {
      type: String,
      // TODO this is temporarily imported from the security module
      enum: Object.values(PlatformTypesEnum),
      required: true
    }
  },
  modelOptions: {
    timestamps: true
  }
};
