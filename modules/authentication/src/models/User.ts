import { ConduitSchema, TYPE } from '@conduit/sdk';

export const UserSchema = new ConduitSchema('User',
  {
    _id: TYPE.ObjectId,
    email: {
      type: TYPE.String,
      unique: true,
      required: true
    },
    hashedPassword: {
      type: TYPE.String,
      select: false
    },
    google: {
      id: {
        type: TYPE.String
      },
      token: {
        type: TYPE.String
      },
      tokenExpires: {
        type: TYPE.String
      }
    },
    facebook: {
      id: {
        type: TYPE.String
      },
      token: {
        type: TYPE.String
      },
      tokenExpires: {
        type: TYPE.String
      }
    },
    active: {
      type: TYPE.Boolean,
      default: true
    },
    isVerified: {
      type: TYPE.Boolean,
      default: false
    },
    createdAt: TYPE.Date,
    updatedAt: TYPE.Date
  },
  {
    timestamps: true,
    systemRequired: true
  });
