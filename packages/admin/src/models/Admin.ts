import { ConduitSchema, TYPE } from '@quintessential-sft/conduit-grpc-sdk';

export const AdminSchema = new ConduitSchema(
  'Admin',
  {
    _id: TYPE.ObjectId,
    username: {
      type: TYPE.String,
      required: true,
      systemRequired: true,
    },
    password: {
      type: TYPE.String,
      required: true,
      systemRequired: true,
    },
    createdAt: TYPE.Date,
    updatedAt: TYPE.Date,
  },
  {
    timestamps: true,
    conduit: {
      permissions: {
        extendable: true,
        canCreate: false,
        canModify: 'ExtensionOnly',
        canDelete: false,
      },
    },
  }
);
