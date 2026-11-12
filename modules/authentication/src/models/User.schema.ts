import {
  CompatibleIndexType,
  ConduitGrpcSdk,
  ConduitModel,
  DatabaseOperations,
  DatabaseProvider,
  type DatabaseTransaction,
  AuthzOptions,
  Indexable,
  PopulateAuthzOptions,
  Query,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';
import { getUserCache, invalidateUsers } from '../utils/sessionServices.js';

interface AuthProviderBase {
  id: string;
  token: string;
  tokenExpires?: Date;
  data: Indexable;
}

interface MetamaskBase {
  ethPublicAddress: string;
  nonce: string;
}

// what database.withOptionalTransaction hands to its callback (see ConduitActiveSchema)
type InTransaction<O> = O & { transaction?: DatabaseOperations };

const authProviderSchema: ConduitModel = {
  id: {
    type: TYPE.String,
  },
  token: {
    type: TYPE.String,
  },
  tokenExpires: {
    type: TYPE.Date,
  },
  data: {
    type: TYPE.JSON,
  },
};

const metamaskSchema: ConduitModel = {
  ethPublicAddress: {
    type: TYPE.String,
    required: false,
  },
  nonce: {
    type: TYPE.String,
    required: false,
  },
};

const schema: ConduitModel = {
  _id: TYPE.ObjectId,
  // do not add unique again, since this will fail due to emails being null
  email: {
    type: TYPE.String,
    required: false,
  },
  username: {
    type: TYPE.String,
    required: false,
  },
  hashedPassword: {
    type: TYPE.String,
    select: false,
  },
  metamask: {
    ...metamaskSchema,
  },
  apple: {
    ...authProviderSchema,
  },
  bitbucket: {
    ...authProviderSchema,
  },
  facebook: {
    ...authProviderSchema,
  },
  figma: {
    ...authProviderSchema,
  },
  github: {
    ...authProviderSchema,
  },
  gitlab: {
    ...authProviderSchema,
  },
  google: {
    ...authProviderSchema,
  },
  linkedin: {
    ...authProviderSchema,
  },
  microsoft: {
    ...authProviderSchema,
  },
  reddit: {
    ...authProviderSchema,
  },
  slack: {
    ...authProviderSchema,
  },
  twitch: {
    ...authProviderSchema,
  },
  twitter: {
    ...authProviderSchema,
  },
  active: {
    type: TYPE.Boolean,
    default: true,
    required: true,
  },
  isVerified: {
    type: TYPE.Boolean,
    default: false,
    required: true,
  },
  hasTwoFA: {
    type: TYPE.Boolean,
    default: false,
    required: true,
  },
  isAnonymous: {
    type: TYPE.Boolean,
    required: false,
  },
  // realm team id the user authenticates at; null/absent = global user
  homeRealm: {
    type: TYPE.ObjectId,
    required: false,
  },
  twoFaMethod: TYPE.String,
  phoneNumber: TYPE.String,
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};
// non-unique: scoped user lookups and realm member counts filter on the home realm
const modelOptions = {
  timestamps: true,
  indexes: [
    {
      fields: ['homeRealm'],
      types: [CompatibleIndexType.Ascending],
    },
  ],
  conduit: {
    permissions: {
      extendable: true,
      canCreate: false,
      canModify: 'ExtensionOnly',
      canDelete: false,
    },
  },
} as const;
const collectionName = undefined;

export class User extends ConduitActiveSchema<User> {
  private static _instance: User;
  _id: string;
  email: string;
  username: string;
  hashedPassword?: string;
  metamask?: MetamaskBase;
  google?: AuthProviderBase;
  facebook?: AuthProviderBase;
  twitch?: AuthProviderBase;
  slack?: AuthProviderBase;
  figma?: AuthProviderBase;
  microsoft?: AuthProviderBase;
  github?: AuthProviderBase;
  active: boolean;
  isVerified: boolean;
  hasTwoFA: boolean;
  twoFaMethod: string;
  phoneNumber?: string;
  isAnonymous?: boolean;
  homeRealm?: string | null;
  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
    super(database, User.name, schema, modelOptions, collectionName);
  }

  /*
   * Every write path of this module goes through this model, so the cached user document
   * (grpcSdk.userCache, read by the GetUser rpc and the jwt-mode middleware) is dropped
   * here, after the write succeeded. The invalidation is best effort and never fails the
   * write, and neither does working out which users are affected:
   *  - no cache configured: nothing to do, no pre-read;
   *  - a filter on `_id` (a string or `$in`) names the ids directly;
   *  - any other filter reads the ids first (the filter may stop matching after the
   *    write); when that read fails the write goes ahead and invalidates nothing.
   * With `{ transaction }` the pre-read runs in that transaction, and the entry is
   * dropped a second time once the transaction has committed: until then a concurrent
   * read still sees, and may cache, the old document.
   */

  private async invalidate(ids: string[], transaction?: DatabaseOperations) {
    await invalidateUsers(ids);
    // by shape rather than instanceof, which fails across two copies of the sdk
    const onCommit = (transaction as Partial<DatabaseTransaction> | undefined)?.onCommit;
    if (typeof onCommit === 'function') {
      onCommit.call(transaction, () => invalidateUsers(ids));
    }
  }

  private async affectedIds(
    filter: Query<User>,
    transaction?: DatabaseOperations,
  ): Promise<string[]> {
    if (!getUserCache()) return [];
    const byId = (filter as { _id?: unknown })._id;
    if (typeof byId === 'string') return [byId];
    const list = (byId as { $in?: unknown } | undefined)?.$in;
    if (Array.isArray(list)) return list.map(String);
    try {
      const rows = await this.findMany(filter, {
        select: '_id',
        readPreference: 'primary',
        ...(transaction && { transaction }),
      });
      return rows.map(row => String(row._id));
    } catch (e) {
      ConduitGrpcSdk.Logger.warn(
        `User cache invalidation skipped, could not read the affected users: ${(e as Error)?.message ?? e}`,
      );
      return [];
    }
  }

  async findByIdAndUpdate(
    id: string,
    document: Query<User>,
    options?: InTransaction<PopulateAuthzOptions>,
  ) {
    const result = await super.findByIdAndUpdate(id, document, options);
    await this.invalidate([id], options?.transaction);
    return result;
  }

  async findByIdAndReplace(
    id: string,
    document: Query<User>,
    options?: InTransaction<PopulateAuthzOptions>,
  ) {
    const result = await super.findByIdAndReplace(id, document, options);
    await this.invalidate([id], options?.transaction);
    return result;
  }

  async replaceOne(
    filter: Query<User>,
    query: Query<User>,
    options?: InTransaction<PopulateAuthzOptions>,
  ) {
    const ids = await this.affectedIds(filter, options?.transaction);
    const result = await super.replaceOne(filter, query, options);
    await this.invalidate(ids, options?.transaction);
    return result;
  }

  async updateOne(
    filter: Query<User>,
    query: Query<User>,
    options?: InTransaction<PopulateAuthzOptions>,
  ) {
    const ids = await this.affectedIds(filter, options?.transaction);
    const result = await super.updateOne(filter, query, options);
    await this.invalidate(ids, options?.transaction);
    return result;
  }

  async updateMany(
    filter: Query<User>,
    query: Query<User>,
    options?: InTransaction<PopulateAuthzOptions>,
  ) {
    const ids = await this.affectedIds(filter, options?.transaction);
    const result = await super.updateMany(filter, query, options);
    await this.invalidate(ids, options?.transaction);
    return result;
  }

  async deleteOne(query: Query<User>, options?: InTransaction<AuthzOptions>) {
    const ids = await this.affectedIds(query, options?.transaction);
    const result = await super.deleteOne(query, options);
    await this.invalidate(ids, options?.transaction);
    return result;
  }

  async deleteMany(query: Query<User>, options?: InTransaction<AuthzOptions>) {
    const ids = await this.affectedIds(query, options?.transaction);
    const result = await super.deleteMany(query, options);
    await this.invalidate(ids, options?.transaction);
    return result;
  }

  static getInstance(database?: DatabaseProvider) {
    if (User._instance) return User._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    User._instance = new User(database);
    return User._instance;
  }
}
