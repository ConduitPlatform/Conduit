import { ConduitSchema, TYPE } from '@conduitplatform/grpc-sdk';

export const MigratedSchemas = new ConduitSchema(
  'MigratedSchemas',
  {
    _id: TYPE.ObjectId,
    name: {
      type: TYPE.String,
      required: true,
    },
    ownerModule: {
      type: TYPE.String,
      required: true,
    },
    version: {
      type: TYPE.Number,
      required: true,
    },
    schema: {
      type: TYPE.JSON,
      required: true,
    },
  },
  {
    timestamps: true,
    conduit: {
      permissions: {
        extendable: false,
        canCreate: false,
        canModify: 'Nothing',
        canDelete: false,
      },
    },
  },
);
