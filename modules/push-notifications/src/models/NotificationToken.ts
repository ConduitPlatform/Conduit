import { ConduitSchema, PlatformTypesEnum, TYPE } from '@conduit/sdk';

export const NotificationTokenModel = new ConduitSchema('NotificationToken',
  {
        _id: TYPE.ObjectId,
        userId: {
            type: TYPE.Relation,
            model: 'User',
            systemRequired: true
        },
        token: {
            type: TYPE.String,
            required: true,
            systemRequired: true
        },
        platform: {
            type: TYPE.String,
            enum: Object.values(PlatformTypesEnum),
            required: true,
            systemRequired: true
        },
        createdAt: TYPE.Date,
        updatedAt: TYPE.Date
    },
  {
      timestamps: true,
      systemRequired: true
  });
