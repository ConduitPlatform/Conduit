import { ConduitSchema, TYPE } from '@conduitplatform/grpc-sdk';

export const Migrations = new ConduitSchema(
  'Migrations',
  {
    _id: TYPE.ObjectId,
    name: {
      type: TYPE.String,
      required: true,
    },
    module: {
      type: TYPE.String,
      required: true,
    },
    version: {
      type: TYPE.String,
      required: true,
    },
    status: {
      type: TYPE.String,
      required: true,
    },
    data: {
      type: TYPE.String,
      required: true,
    },
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
  },
  'migrations',
);
