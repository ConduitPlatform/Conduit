import {
  ConduitActiveSchema,
  DatabaseProvider,
  TYPE,
} from '@quintessential-sft/conduit-grpc-sdk';
import { PaymentsCustomer } from './PaymentsCustomer.schema';
import { Transaction } from './Transaction.schema';

const schema = {
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

export class Subscription extends ConduitActiveSchema<Subscription> {
  private static _instance: Subscription;
  _id!: string;
  product!: string;
  customerId!: string | PaymentsCustomer;
  activeUntil!: Date;
  transactions!: (string | Transaction) [];
  createdAt!: Date;
  updatedAt!: Date;

  private constructor(database: DatabaseProvider) {
    super(database, Subscription.name, schema, schemaOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (Subscription._instance) return Subscription._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    Subscription._instance = new Subscription(database);
    return Subscription._instance;
  }
}
