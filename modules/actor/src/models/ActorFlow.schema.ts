import { ConduitSchema, TYPE } from '@quintessential-sft/conduit-grpc-sdk';

export const ActorFlowSchema = new ConduitSchema(
  'ActorFlows',
  {
    _id: TYPE.ObjectId,
    name: {
      type: TYPE.String,
      required: true,
      unique: true,
      systemRequired: true,
    },
    trigger: {
      type: {
        name: TYPE.String,
        options: TYPE.JSON,
      },
      required: true,
      systemRequired: true,
    },
    actors: {
      type: [
        {
          name: TYPE.String,
          options: TYPE.JSON,
        },
      ],
      required: true,
      systemRequired: true,
    },
    enabled: {
      type: TYPE.Boolean,
      default: true,
    },
    createdAt: TYPE.Date,
    updatedAt: TYPE.Date,
  },
  {
    timestamps: true,
    systemRequired: true,
  },
);
