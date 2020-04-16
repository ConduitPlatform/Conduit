import { ConduitSchema, PlatformTypesEnum, TYPE } from '@conduit/sdk';

export const NotificationTokenModel = new ConduitSchema('NotificationToken',
  {
        _id: TYPE.ObjectId,
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
