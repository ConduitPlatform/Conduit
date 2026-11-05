import {
  CompatibleIndexType,
  ConduitModel,
  DatabaseProvider,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';
import { User, AccessToken } from './index.js';

const schema: ConduitModel = {
  _id: TYPE.ObjectId,
  user: {
    type: TYPE.Relation,
    model: 'User',
    required: true,
  },
  accessToken: {
    type: TYPE.Relation,
    model: 'AccessToken',
    // absent in jwt mode (no AccessToken rows are created)
    required: false,
  },
  clientId: {
    type: TYPE.String,
    required: false,
  },
  // realm team id the session is in; absent = global session
  realm: {
    type: TYPE.ObjectId,
    required: false,
  },
  // SHA-256 hex of the random refresh token; the plaintext is returned once at mint.
  // Plain non-unique index: `sparse` is not portable (the SQL adapter drops the whole
  // index), and 512-bit random tokens make collisions moot, so uniqueness is not needed.
  tokenHash: {
    type: TYPE.String,
    required: true,
    index: {
      type: CompatibleIndexType.Ascending,
    },
  },
  // legacy plaintext token: only read (select: '+token') and cleared by the startup
  // migration; never written
  token: {
    type: TYPE.String,
    required: false,
    select: false,
  },
  issuedAt: {
    type: TYPE.Date,
    required: true,
  },
  extendable: {
    type: TYPE.Boolean,
    default: true,
  },
  // absolute cap: extension never passes it
  maxExpiresOn: {
    type: TYPE.Date,
    required: true,
  },
  expiresOn: {
    type: TYPE.Date,
    required: true,
  },
  securityDetails: {
    macAddress: TYPE.String,
    userAgent: TYPE.String,
  },
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};
// non-unique: realm sweeps (demote, guest removal) delete tokens by realm
const modelOptions = {
  timestamps: true,
  indexes: [
    {
      fields: ['realm'],
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

export class RefreshToken extends ConduitActiveSchema<RefreshToken> {
  private static _instance: RefreshToken;
  _id: string;
  user: string | User;
  clientId: string;
  realm?: string;
  tokenHash: string;
  /** legacy plaintext token (select: false), cleared by the migration */
  token?: string | null;
  /** absent on legacy rows not migrated yet */
  issuedAt?: Date;
  extendable: boolean;
  maxExpiresOn?: Date;
  accessToken?: string | AccessToken;
  expiresOn: Date;
  securityDetails?: {
    macAddress: string;
    userAgent: string;
  };
  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
    super(database, RefreshToken.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (RefreshToken._instance) return RefreshToken._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    RefreshToken._instance = new RefreshToken(database);
    return RefreshToken._instance;
  }
}
