import { ConduitSchema, TYPE } from '@conduitplatform/grpc-sdk';
export const Views = new ConduitSchema(
  'Views',
  {
    _id: TYPE.ObjectId,
    name: {
      type: TYPE.String,
      required: true,
    },
    originalSchema: {
      type: TYPE.String,
      required: true,
    },
    query: {
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
