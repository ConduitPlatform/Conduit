import { ConduitSchema, TYPE } from '@quintessential-sft/conduit-grpc-sdk';

export const SubscriptionSchema = new ConduitSchema(
  'Subscription',
  {
    _id: TYPE.ObjectId,
    product: {
      type: TYPE.Relation,
      model: 'Product',
    },
    customerId: {
      type: TYPE.Relation,
      model: 'PaymentsCustomer',
    },
    activeUntil: TYPE.Date,
    transactions: [
      {
        type: TYPE.Relation,
        model: 'Transaction',
      },
    ],
    provider: TYPE.String,
    createdAt: TYPE.Date,
    updatedAt: TYPE.Date,
  },
  {
    timestamps: true,
    systemRequired: true,
  }
);
