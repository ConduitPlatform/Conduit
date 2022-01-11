import {
  ConduitActiveSchema,
  DatabaseProvider,
  TYPE,
} from '@quintessential-sft/conduit-grpc-sdk';
import { PaymentsCustomer } from './PaymentsCustomer.schema';
import { Product } from './Product.schema';

const schema = {
  _id: TYPE.ObjectId,
  customerId: {
    type: TYPE.Relation,
    model: 'PaymentsCustomer',
    required: true,
  },
  provider: {
    type: TYPE.String,
    required: true,
  },
  product: {
    type: TYPE.Relation,
    model: 'Product',
    required: true,
  },
  quantity: {
    type: TYPE.Number,
    default: 1,
    required: true,
  },
  data: {
    type: TYPE.JSON,
    required: true,
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

export class Transaction extends ConduitActiveSchema<Transaction> {
  private static _instance: Transaction;
  _id!: string;
  customerId!: string | PaymentsCustomer;
  provider!: string;
  product!: string | Product;
  quantity: number = 1;
  data!: any;
  createdAt!: Date;
  updatedAt!: Date;

  private constructor(database: DatabaseProvider) {
    super(database, Transaction.name, schema, schemaOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (Transaction._instance) return Transaction._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    Transaction._instance = new Transaction(database);
    return Transaction._instance;
  }
}
