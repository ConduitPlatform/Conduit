import {ConduitSchema, TYPE} from '@quintessential-sft/conduit-grpc-sdk';

export const TransactionSchema = new ConduitSchema('Transaction',
  {
    _id: TYPE.ObjectId,
    userId: {
      type: TYPE.Relation,
      model: 'User'
    },
    provider: TYPE.String,
    product: {
      type: TYPE.Relation,
      model: 'Product'
    },
    data: TYPE.JSON,
    createdAt: TYPE.Date,
    updatedAt: TYPE.Date
  },
  {
    timestamps: true,
    systemRequired: true
  })
