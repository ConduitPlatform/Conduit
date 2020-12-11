import {ConduitSchema, TYPE} from '@quintessential-sft/conduit-grpc-sdk';


export const UserSchema = new ConduitSchema('User',
  {
    _id: TYPE.ObjectId,
    email: {
      type: TYPE.String,
      unique: true,
      required: false,
      systemRequired: true
    },
    hashedPassword: {
      type: TYPE.String,
      select: false,
      systemRequired: true
    },
    google: {
      id: {
        type: TYPE.String,
        systemRequired: true
      },
      token: {
        type: TYPE.String,
        systemRequired: true
      },
      tokenExpires: {
        type: TYPE.String,
        systemRequired: true
      }
    },
    facebook: {
      id: {
        type: TYPE.String,
        systemRequired: true
      },
      token: {
        type: TYPE.String,
        systemRequired: true
      },
      tokenExpires: {
        type: TYPE.String,
        systemRequired: true
      }
    },
    kakao: {
      id: {
        type: TYPE.String,
        systemRequired: true
      },
      token: {
        type: TYPE.String,
        systemRequired: true,
      },
      tokenExpires: {
        type: TYPE.String,
        systemRequired: true
      },
      profile_image_url: TYPE.String,
      thumbnail_image_url: TYPE.String
    },
    twitch: {
      id: {
        type: TYPE.String,
        systemRequired: true
      },
      token: {
        type: TYPE.String,
        systemRequired: true,
      },
      tokenExpires: {
        type: TYPE.String,
        systemRequired: true
      },
      profile_image_url: TYPE.String
    },
    active: {
      type: TYPE.Boolean,
      default: true,
      systemRequired: true
    },
    isVerified: {
      type: TYPE.Boolean,
      default: false,
      systemRequired: true
    },
    hasTwoFA: {
      type: TYPE.Boolean,
      default: false,
      systemRequired: true
    },
    phoneNumber: TYPE.String,
    createdAt: TYPE.Date,
    updatedAt: TYPE.Date
  },
  {
    timestamps: true,
    systemRequired: true
  });
