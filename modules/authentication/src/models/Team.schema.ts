import { ConduitModel, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';

const schema: ConduitModel = {
  _id: TYPE.ObjectId,
  parentTeam: {
    type: TYPE.ObjectId,
  },
  name: {
    type: TYPE.String,
    required: true,
  },
  isDefault: {
    type: TYPE.Boolean,
    default: false,
  },
  // Public, non-secret realm marker. Realm configuration lives in RealmSettings.
  // Slug uniqueness is NOT enforced by an index: a unique index on the nested
  // `realm.slug` path is not portable across Mongo and the SQL dialects (nested objects
  // are JSON there, and the many teams without a slug would need a sparse/partial
  // unique index, which has no portable option). It is enforced in the application by
  // `assertSlugAvailable` in utils/realm.ts instead.
  realm: {
    enabled: {
      type: TYPE.Boolean,
      default: false,
    },
    slug: {
      type: TYPE.String,
    },
  },
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};
const modelOptions = {
  timestamps: true,
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

export class Team extends ConduitActiveSchema<Team> {
  private static _instance: Team;
  _id: string;
  //todo rename
  declare name: string;
  parentTeam: string;
  isDefault: boolean;
  realm?: {
    enabled: boolean;
    slug?: string;
  };
  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
    super(database, Team.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (Team._instance) return Team._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    Team._instance = new Team(database);
    return Team._instance;
  }
}
