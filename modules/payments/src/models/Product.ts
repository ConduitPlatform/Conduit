import { ConduitSchema, TYPE } from '@quintessential-sft/conduit-grpc-sdk';

export const ProductSchema = new ConduitSchema(
  'Product',
  {
    _id: TYPE.ObjectId,
    name: {
      type: TYPE.String,
      required: true,
    },
    value: {
      type: TYPE.Number,
      required: true,
    },
    currency: {
      type: TYPE.String,
      required: true,
    },
    isSubscription: {
      type: TYPE.Boolean,
      default: false,
    },
    recurring: {
      type: TYPE.String,
      default: '',
    },
    recurringCount: {
      type: TYPE.Number,
      default: 1,
    },
    stripe: {
      subscriptionId: TYPE.String,
      priceId: TYPE.String,
    },
    createdAt: TYPE.Date,
    updatedAt: TYPE.Date,
  },
  {
    timestamps: true,
    systemRequired: true,
  }
);
