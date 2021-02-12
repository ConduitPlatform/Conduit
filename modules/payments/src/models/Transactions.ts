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
    quantity: {
      type: TYPE.Number,
      default: 1
    },
    data: TYPE.JSON,
    createdAt: TYPE.Date,
    updatedAt: TYPE.Date
  },
  {
    timestamps: true,
    systemRequired: true
  })
