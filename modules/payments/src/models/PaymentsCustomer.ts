import {ConduitSchema, TYPE} from '@quintessential-sft/conduit-grpc-sdk';

export const PaymentsCustomerSchema = new ConduitSchema('PaymentsCustomer',
  {
    _id: TYPE.ObjectId,
    customerId: {
      type: TYPE.String,
      unique: true
    },
    userId: {
      type: TYPE.Relation,
      model: 'User'
    },
    provider: TYPE.String,
    paymentMethod: TYPE.JSON,
    createdAt: TYPE.Date,
    updatedAt: TYPE.Date
  },
  {
    timestamps: true,
    systemRequired: true
  })