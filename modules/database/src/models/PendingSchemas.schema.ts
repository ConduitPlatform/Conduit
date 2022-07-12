import { ConduitSchema, TYPE } from '@conduitplatform/grpc-sdk';

export const PendingSchemas = new ConduitSchema(
  '_PendingSchemas',
  {
    _id: TYPE.ObjectId,
    name: {
      type: TYPE.String,
      unique: true,
      required: true,
    },
    fields: {
      type: TYPE.JSON,
      required: true,
    },
    modelOptions: {
      type: TYPE.JSON,
      required: true,
    },
    createdAt: TYPE.Date,
    updatedAt: TYPE.Date,
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
  'cnd_pendingschemas',
);
