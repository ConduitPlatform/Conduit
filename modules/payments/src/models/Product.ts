import {ConduitSchema, TYPE} from '@quintessential-sft/conduit-grpc-sdk';

export const ProductSchema = new ConduitSchema('Product',
  {
    _id: TYPE.ObjectId,
    name: TYPE.String,
    value: TYPE.Number,
    currency: TYPE.String,
    isSubscription: TYPE.Boolean,
    renewEvery: TYPE.String,
  },
  {
    timestamps: true,
    systemRequired: true
  })