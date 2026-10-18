import {
  CompatibleIndexType,
  ConduitModel,
  DatabaseProvider,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';
import { RealmMembershipType } from '../utils/realm.logic.js';

// `user` and `realm` are plain ObjectIds (not Relations) so the compound index stays
// portable: SQL relation fields are not indexable on register.
const schema: ConduitModel = {
  _id: TYPE.ObjectId,
  user: {
    type: TYPE.ObjectId,
    required: true,
  },
  // realm team id
  realm: {
    type: TYPE.ObjectId,
    required: true,
  },
  // The contract calls this field `type`, but a model field named `type` collides with
  // the schema type declaration key, so it is stored as `membershipType`.
  membershipType: {
    type: TYPE.String,
    enum: ['home', 'guest'],
    required: true,
  },
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};
const modelOptions = {
  timestamps: true,
  indexes: [
    {
      fields: ['user', 'realm'],
      types: [CompatibleIndexType.Ascending, CompatibleIndexType.Ascending],
      options: { unique: true },
    },
    {
      fields: ['realm'],
      types: [CompatibleIndexType.Ascending],
    },
  ],
  conduit: {
    permissions: {
      extendable: false,
      canCreate: false,
      canModify: 'Nothing',
      canDelete: false,
    },
  },
} as const;
const collectionName = undefined;

export class RealmMembership extends ConduitActiveSchema<RealmMembership> {
  private static _instance: RealmMembership;
  _id: string;
  user: string;
  realm: string;
  membershipType: RealmMembershipType;
  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
    super(database, RealmMembership.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (RealmMembership._instance) return RealmMembership._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    RealmMembership._instance = new RealmMembership(database);
    return RealmMembership._instance;
  }
}
