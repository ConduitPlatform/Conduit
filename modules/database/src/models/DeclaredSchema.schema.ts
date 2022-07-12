import { ConduitSchema, TYPE } from '@conduitplatform/grpc-sdk';

export const DeclaredSchema = new ConduitSchema(
  '_DeclaredSchema',
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
    collectionName: {
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
  },
  'cnd_declaredschemas',
);
