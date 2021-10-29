import { ConduitSchema, TYPE } from '@quintessential-sft/conduit-grpc-sdk';

export const PaymentsCustomerSchema = new ConduitSchema(
  'PaymentsCustomer',
  {
    _id: TYPE.ObjectId,
    userId: {
      type: TYPE.Relation,
      model: 'User',
    },
    email: {
      type: TYPE.String,
      required: true,
    },
    phoneNumber: {
      type: TYPE.String,
      required: true
    },
    buyerName: TYPE.String,
    address: TYPE.String,
    postCode: TYPE.String,
    stripe: {
      customerId: TYPE.String,
    },
    createdAt: TYPE.Date,
    updatedAt: TYPE.Date,
  },
  {
    timestamps: true,
    systemRequired: true,
  }
);
