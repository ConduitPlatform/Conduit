import {ConduitSchema, TYPE} from '@quintessential-sft/conduit-grpc-sdk';

export const TransactionSchema = new ConduitSchema('Transaction',
  {
    _id: TYPE.ObjectId,
    userId: {
      type: TYPE.Relation,
      model: 'User'
    },
    provider: TYPE.String,
    data: TYPE.JSON,
    iamport: {
      merchantId: TYPE.String
    },
    createdAt: TYPE.Date,
    updatedAt: TYPE.Date
  },
  {
    timestamps: true,
    systemRequired: true
  })