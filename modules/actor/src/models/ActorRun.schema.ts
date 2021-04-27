import { ConduitSchema, TYPE } from '@quintessential-sft/conduit-grpc-sdk';

export const RunsSchema = new ConduitSchema(
  'ActorRuns',
  {
    _id: TYPE.ObjectId,
    flow: {
      type: TYPE.Relation,
      model: 'ActorFlow',
      required: true,
      systemRequired: true,
    },
    data: {
      type: TYPE.JSON,
      required: false,
      systemRequired: true,
    },
    status: {
      type: TYPE.String,
    },
    createdAt: TYPE.Date,
    updatedAt: TYPE.Date,
  },
  {
    timestamps: true,
    systemRequired: true,
  }
);
