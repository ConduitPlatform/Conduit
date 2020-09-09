import {ConduitSchema, TYPE} from '@quintessential-sft/conduit-grpc-sdk';


export const UserSchema = new ConduitSchema('User',
  {
    _id: TYPE.ObjectId,
    email: {
      type: TYPE.String,
      unique: true,
      required: true,
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
    createdAt: TYPE.Date,
    updatedAt: TYPE.Date
  },
  {
    timestamps: true,
    systemRequired: true
  });
