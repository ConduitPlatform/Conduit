import { ConduitSchema, TYPE } from '@quintessential-sft/conduit-grpc-sdk';

const schema = new ConduitSchema(
  '_declaredSchema',
  {
    _id: TYPE.ObjectId,
    name: {
      type: TYPE.String,
      unique: true,
      required: true,
      systemRequired: true,
    },
    fields: {
      type: TYPE.JSON,
      required: true,
      systemRequired: true,
    },
    modelOptions: { type: TYPE.String, systemRequired: true },
    ownerModule: {
      type: TYPE.String,
      required: true,
    },
    createdAt: TYPE.Date,
    updatedAt: TYPE.Date,
  },
  {
    timestamps: true,
    systemRequired: true,
  }
);
export default schema;
