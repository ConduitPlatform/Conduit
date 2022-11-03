import { ConduitActiveSchema, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';

const schema = {
  _id: TYPE.ObjectId,
  parentTeam: {
    type: TYPE.ObjectId,
  },
  name: {
    type: TYPE.String,
    required: true,
  },
  isDefault: {
    type: TYPE.String,
    default: false,
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
  name: string;
  parentTeam: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;

  constructor(database: DatabaseProvider) {
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
