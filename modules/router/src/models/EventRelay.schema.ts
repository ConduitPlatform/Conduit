import {
  ConduitModel,
  DatabaseProvider,
  Indexable,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';

const schema: ConduitModel = {
  _id: TYPE.ObjectId,
  name: {
    type: TYPE.String,
    unique: true,
    required: true,
  },
  notes: {
    type: TYPE.String,
    required: false,
  },
  active: {
    type: TYPE.Boolean,
    required: true,
    default: true,
  },
  busEvent: {
    type: TYPE.String,
    required: true,
  },
  socketEvent: {
    type: TYPE.String,
    required: true,
  },
  resourceType: {
    type: TYPE.String,
    required: true,
  },
  resourceIdPath: {
    type: TYPE.String,
    required: true,
  },
  permission: {
    type: TYPE.String,
    required: true,
  },
  messageTemplate: {
    type: TYPE.JSON,
    required: true,
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

export class EventRelay extends ConduitActiveSchema<EventRelay> {
  private static _instance: EventRelay;
  _id!: string;
  declare name: string;
  notes?: string;
  active!: boolean;
  busEvent!: string;
  socketEvent!: string;
  resourceType!: string;
  resourceIdPath!: string;
  permission!: string;
  messageTemplate!: Indexable;
  createdAt!: Date;
  updatedAt!: Date;

  private constructor(database: DatabaseProvider) {
    super(database, EventRelay.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (EventRelay._instance) return EventRelay._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    EventRelay._instance = new EventRelay(database);
    return EventRelay._instance;
  }
}
