import { ConduitSchema, TYPE } from '@quintessential-sft/conduit-grpc-sdk';

const schema = new ConduitSchema(
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
        required: true,
      },
    ],
    returns: {
      type: TYPE.JSON,
      required: true,
    },
    enabled: {
      type: TYPE.Boolean,
      default: true,
      systemRequired: true,
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
    queries: [TYPE.JSON],
    assignments: [TYPE.JSON],
    createdAt: TYPE.Date,
    updatedAt: TYPE.Date,
  },
  {
    timestamps: true,
  }
);
export default schema;
