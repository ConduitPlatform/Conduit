import {ConduitSchema, TYPE} from '@quintessential-sft/conduit-grpc-sdk';

export const SubscriptionSchema = new ConduitSchema('Subscription',
  {
    _id: TYPE.ObjectId,
    productId: {
      type: TYPE.Relation,
      model: 'Product'
    },
    userId: {
      type: TYPE.Relation,
      model: 'User'
    },
    customerId: {
      type: TYPE.Relation,
      model: 'PaymentsCustomer'
    },
    iamport: {
      nextPaymentId: TYPE.String
    },
    activeUntil: TYPE.Date,
    transactions: TYPE.ObjectId,
    provider: TYPE.String,
    createdAt: TYPE.Date,
    updatedAt: TYPE.Date
  },
  {
    timestamps: true,
    systemRequired: true
  });