import { ConduitActiveSchema, DatabaseProvider, TYPE } from '@quintessential-sft/conduit-grpc-sdk';
import { User } from './User.model';

const schema = {
  _id: TYPE.ObjectId,
  // ------------------
  // Your custom fields
  foo: {
    type: TYPE.Boolean,
    required: true,
    default: false,
  },
  bar: TYPE.String,
  userId: {
    type: TYPE.Relation,
    model: 'User',
    required: true,
  },
  // ------------------
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};
const schemaOptions = {
  timestamps: true,
  conduit: {
    permissions: {
      // NOTICE:
      // These are Optional. Database module sets default values (no restrictions)
      extendable: true,
      canCreate: false,
      canModify: 'ExtensionOnly',
      canDelete: false,
    },
  },
};
const collectionName = undefined;

export class Foobar extends ConduitActiveSchema<Foobar> {
  private static _instance: Foobar;
  _id!: string;
  foo!: boolean;
  bar?: string;
  userId!: string | User;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(database: DatabaseProvider) {
    super(database, Foobar.name, schema, schemaOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (Foobar._instance) return Foobar._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    Foobar._instance = new Foobar(database);
    return Foobar._instance;
  }
}
