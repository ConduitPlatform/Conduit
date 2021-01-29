import {ConduitSchema, TYPE} from '@quintessential-sft/conduit-grpc-sdk';

export const PaymentsCustomerSchema = new ConduitSchema('PaymentsCustomer',
  {
    _id: TYPE.ObjectId,
    userId: {
      type: TYPE.Relation,
      model: 'User'
    },
    stripe: {
      customerId: TYPE.String
    },
    iamport: {
      email: TYPE.String,
      buyerName: TYPE.String,
      phoneNumber: TYPE.String,
      address: TYPE.String,
      postCode: TYPE.String,
      isCardVerified: {
        type: TYPE.Boolean,
        default: false,
        systemRequired: true
      }
    },
    createdAt: TYPE.Date,
    updatedAt: TYPE.Date
  },
  {
    timestamps: true,
    systemRequired: true
  })