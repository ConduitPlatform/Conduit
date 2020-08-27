import {ConduitSchema, TYPE} from "@quintessential-sft/conduit-grpc-sdk";

export default new ConduitSchema(
  'File',
  {
    _id: TYPE.ObjectId,
    name: {
      type: TYPE.String,
      required: true,
      systemRequired: true
    },
    folder: {
      type: TYPE.String,
      required: true,
      systemRequired: true
    },
    mimeType: { type: TYPE.String, systemRequired: true },
    createdAt: TYPE.Date,
    updatedAt: TYPE.Date
  },
  {
    timestamps: true,
    systemRequired: true
  }
);
