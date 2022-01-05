import {
  ConduitActiveSchema,
  DatabaseProvider,
  TYPE,
} from '@quintessential-sft/conduit-grpc-sdk';
import { User } from './User.model';

const schema = {
  _id: TYPE.ObjectId,
  userId: {
    type: TYPE.Relation,
    model: 'User',
    required: true,
  },
  email: {
    type: TYPE.String,
    required: true,
  },
  phoneNumber: {
    type: TYPE.String,
    required: true,
  },
  buyerName: {
    type: TYPE.String,
    required: true,
  },
  address: {
    type: TYPE.String,
    required: true,
  },
  postCode: {
    type: TYPE.String,
    required: true,
  },
  stripe: {
    customerId: { type: TYPE.String, required: true },
    // required: true, // cannot set #1zndxe5
  },
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};
const schemaOptions = {
  timestamps: true,
  conduit: {
    permissions: {
      extendable: true,
      canCreate: false,
      canModify: 'ExtensionOnly',
      canDelete: false,
    },
  },
};
const collectionName = undefined;

export class PaymentsCustomer extends ConduitActiveSchema<PaymentsCustomer> {
  private static _instance: PaymentsCustomer;
  _id!: string;
  userId!: string | User;
  email!: string;
  phoneNumber!: string;
  buyerName!: string;
  address!: string;
  postCode!: string;
  stripe!: {
    customerId: string;
  };
  createdAt!: Date;
  updatedAt!: Date;

  private constructor(database: DatabaseProvider) {
    super(database, PaymentsCustomer.name, schema, schemaOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (PaymentsCustomer._instance) return PaymentsCustomer._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    PaymentsCustomer._instance = new PaymentsCustomer(database);
    return PaymentsCustomer._instance;
  }
}
