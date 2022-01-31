import {
  ConduitActiveSchema,
  DatabaseProvider,
  TYPE,
} from '@conduitplatform/conduit-grpc-sdk';
import { PaymentsCustomer } from './PaymentsCustomer.schema';
import { Product } from './Product.schema';

const schema = {
  _id: TYPE.ObjectId,
  customerId: {
    type: TYPE.Relation,
    model: 'PaymentsCustomer',
  },
  provider: TYPE.String,
  product: {
    type: TYPE.Relation,
    model: 'Product',
  },
  quantity: {
    type: TYPE.Number,
    default: 1,
  },
  data: TYPE.JSON,
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};
const schemaOptions = {
  timestamps: true,
  systemRequired: true,
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
