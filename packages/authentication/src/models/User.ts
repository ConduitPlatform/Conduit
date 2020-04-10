import { ConduitSchema, TYPE } from '@conduit/sdk';

export const UserSchema = new ConduitSchema('User',
  {
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
      },
      refreshToken: {
        type: TYPE.String
      },
      refreshTokenExpires: {
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
      },
      refreshToken: {
        type: TYPE.String
      },
      refreshTokenExpires: {
        type: TYPE.String
      }
    },
    active: {
      type: TYPE.Boolean,
      default: true
    },
    isVerified: {type: TYPE.Boolean, default: false},
  },
  {
    timestamps: true
  });
