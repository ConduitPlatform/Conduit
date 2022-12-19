import { ConduitSchema, TYPE } from '@conduitplatform/grpc-sdk';

export const Versions = new ConduitSchema(
  'Versions',
  {
    _id: TYPE.ObjectId,
    moduleName: {
      type: TYPE.String,
      required: true,
    },
    version: {
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
  'versions',
);
