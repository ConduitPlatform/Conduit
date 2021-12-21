import {
  ConduitActiveSchema,
  DatabaseProvider,
  TYPE,
} from '@quintessential-sft/conduit-grpc-sdk';

const schema = {
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
};
const schemaOptions = {
  timestamps: true,
  conduit: {
    permissions: {
      extendable: true,
      canCreate: true,
      canModify: 'Everything',
      canDelete: true,
    },
  },
};
const collectionName = undefined;

export class Product extends ConduitActiveSchema<Product> {
  private static _instance: Product;
  _id!: string;
  name!: string;
  value!: number;
  currency!: string;
  isSubscription!: boolean;
  recurring!: boolean;
  recurringCount!: number;
  stripe!: {
    subscriptionId: string;
    priceId: string;
  };
  createdAt!: Date;
  updatedAt!: Date;

  private constructor(database: DatabaseProvider) {
    super(database, Product.name, schema, schemaOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (Product._instance) return Product._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    Product._instance = new Product(database);
    return Product._instance;
  }
}
