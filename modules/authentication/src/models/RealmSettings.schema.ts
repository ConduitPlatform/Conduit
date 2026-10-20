import {
  CompatibleIndexType,
  ConduitModel,
  DatabaseProvider,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';
import {
  REALM_OAUTH_PROVIDERS,
  RealmLinking,
  RealmOAuthSecrets,
  RealmPolicies,
  StoredRealmStrategies,
} from '../utils/realm.logic.js';

const enabledFlag = (def = false) => ({ type: TYPE.Boolean, default: def }) as const;

function oauthProviderSchema(provider: string): ConduitModel {
  return {
    enabled: enabledFlag(),
    clientId: { type: TYPE.String, required: false },
    redirect_uri: { type: TYPE.String, required: false },
    accountLinking: { type: TYPE.Boolean, required: false },
    ...(provider === 'apple'
      ? {
          teamId: { type: TYPE.String, required: false },
          keyId: { type: TYPE.String, required: false },
        }
      : {}),
  };
}

const oauthSchema: ConduitModel = Object.fromEntries(
  REALM_OAUTH_PROVIDERS.map(provider => [provider, oauthProviderSchema(provider)]),
);

const schema: ConduitModel = {
  _id: TYPE.ObjectId,
  // realm team id. Uniqueness is guaranteed by the unique index below.
  team: {
    type: TYPE.ObjectId,
    required: true,
    index: {
      type: CompatibleIndexType.Ascending,
      options: { unique: true },
    },
  },
  active: {
    type: TYPE.Boolean,
    default: true,
    required: true,
  },
  strategies: {
    local: {
      enabled: enabledFlag(true),
      verificationRequired: { type: TYPE.Boolean, required: false },
    },
    username: { enabled: enabledFlag() },
    magicLink: { enabled: enabledFlag() },
    phone: { enabled: enabledFlag() },
    metamask: { enabled: enabledFlag() },
    biometric: { enabled: enabledFlag() },
    oauth: oauthSchema,
  },
  registration: {
    allowWithoutInvite: enabledFlag(),
  },
  policies: {
    requireTwoFa: enabledFlag(),
    requireVerifiedEmail: enabledFlag(),
    // `default: []` because SQL stores primitive arrays joined by ';' (NULL crashes the
    // getter). Readers still go through normalizeIdList: `[]` reads back as `['']`.
    allowedClientIds: { type: [TYPE.String], default: [] },
    guests: {
      allowed: enabledFlag(true),
      allowedHomeRealms: { type: [TYPE.ObjectId], default: [] },
      directSignIn: enabledFlag(true),
    },
  },
  // account linking: inbound accounts from other realms may connect here (off by default),
  // outbound accounts of this realm may connect elsewhere (on by default)
  linking: {
    inbound: enabledFlag(),
    outbound: enabledFlag(true),
  },
  // OAuth secrets, kept out of `strategies.oauth` because nested `select: false` is not
  // portable (SQL excludes by leaf name against flattened columns). Shape:
  //   { [provider]: { clientSecret?: string; privateKey?: string } }
  // Never returned by default reads; select it with `select: '+oauthSecrets'` (same
  // pattern as User.hashedPassword). Use maskRealmSettings/splitRealmSettingsInput.
  oauthSecrets: { type: TYPE.JSON, select: false },
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};
const modelOptions = {
  timestamps: true,
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

export class RealmSettings extends ConduitActiveSchema<RealmSettings> {
  private static _instance: RealmSettings;
  _id: string;
  team: string;
  active: boolean;
  strategies: StoredRealmStrategies;
  registration: { allowWithoutInvite: boolean };
  policies: RealmPolicies;
  linking: RealmLinking;
  /** select: false; only present when read with `select: '+oauthSecrets'`. */
  oauthSecrets?: RealmOAuthSecrets | null;
  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
    super(database, RealmSettings.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (RealmSettings._instance) return RealmSettings._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    RealmSettings._instance = new RealmSettings(database);
    return RealmSettings._instance;
  }
}
