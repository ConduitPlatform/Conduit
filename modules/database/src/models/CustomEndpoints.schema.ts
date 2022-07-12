import { ConduitSchema, TYPE } from '@conduitplatform/grpc-sdk';

export const CustomEndpoints = new ConduitSchema(
  'CustomEndpoints',
  {
    _id: TYPE.ObjectId,
    name: {
      type: TYPE.String,
      unique: true,
      required: true,
    },
    operation: {
      type: TYPE.Number,
      required: true,
    },
    selectedSchema: {
      type: TYPE.ObjectId,
      required: false,
    },
    selectedSchemaName: {
      type: TYPE.String,
      required: true,
    },
    inputs: [
      {
        type: TYPE.JSON,
      },
    ],
    returns: {
      type: TYPE.JSON,
      required: true,
    },
    enabled: {
      type: TYPE.Boolean,
      default: true,
    },
    authentication: {
      type: TYPE.Boolean,
      default: false,
    },
    paginated: {
      type: TYPE.Boolean,
      default: false,
    },
    sorted: {
      type: TYPE.Boolean,
      default: false,
    },
    query: TYPE.JSON,
    assignments: [TYPE.JSON],
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
  },
  'cnd_customendpoints',
);
