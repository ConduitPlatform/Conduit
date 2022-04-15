// import { DeclaredSchema } from './DeclaredSchema.schema';

// const PendingSchemas = JSON.parse(JSON.stringify(DeclaredSchema));
// (PendingSchemas as any).name = '_PendingSchemas';

// export { PendingSchemas };

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
    extensions: [
      {
        fields: {
          type: TYPE.JSON,
          required: true,
        },
        ownerModule: {
          type: TYPE.String,
          required: true,
        },
        createdAt: TYPE.Date,
        updatedAt: TYPE.Date,
      },
    ],
    modelOptions: {
      type: TYPE.JSON,
      required: true,
    },
    ownerModule: {
      type: TYPE.String,
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
  }
);
