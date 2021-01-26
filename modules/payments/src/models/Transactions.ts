import {ConduitSchema, TYPE} from '@quintessential-sft/conduit-grpc-sdk';

export const TransactionSchema = new ConduitSchema('Transaction',
  {
    _id: TYPE.ObjectId,
    provider: TYPE.String,
    data: TYPE.JSON,
    createdAt: TYPE.Date,
    updatedAt: TYPE.Date
  },
  {
    timestamps: true,
    systemRequired: true
  })