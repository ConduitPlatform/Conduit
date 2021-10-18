import { ConduitSchema, TYPE } from '@quintessential-sft/conduit-grpc-sdk';

export default new ConduitSchema(
  '_StorageContainer',
  {
    _id: TYPE.ObjectId,
    name: {
      type: TYPE.String,
      required: true,
      systemRequired: true,
    },
    isPublic: {
      type: TYPE.Boolean,
      default: false,
    },
    createdAt: TYPE.Date,
    updatedAt: TYPE.Date,
  },
  {
    timestamps: true,
    systemRequired: true,
  }
);
