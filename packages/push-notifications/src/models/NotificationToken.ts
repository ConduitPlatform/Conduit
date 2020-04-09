import { ConduitSchema, PlatformTypesEnum, TYPE } from '@conduit/sdk';

export const NotificationTokenModel = new ConduitSchema('NotificationToken',
  {

        userId: {
            type: TYPE.Relation,
            model: 'User'
        },
        token: {
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
