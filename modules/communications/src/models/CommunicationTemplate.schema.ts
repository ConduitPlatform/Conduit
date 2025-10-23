import {
  ConduitModel,
  DatabaseProvider,
  SQLDataType,
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
  channels: {
    type: [TYPE.String],
    enum: ['email', 'push', 'sms'],
    required: true,
  },
  email: {
    subject: {
      type: TYPE.String,
      sqlType: SQLDataType.TEXT,
    },
    body: {
      type: TYPE.String,
      sqlType: SQLDataType.TEXT,
    },
    sender: {
      type: TYPE.String,
    },
  },
  push: {
    title: {
      type: TYPE.String,
    },
    body: {
      type: TYPE.String,
    },
  },
  sms: {
    message: {
      type: TYPE.String,
      sqlType: SQLDataType.TEXT,
    },
  },
  variables: {
    type: [TYPE.String],
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

export class CommunicationTemplate extends ConduitActiveSchema<CommunicationTemplate> {
  private static _instance: CommunicationTemplate;
  _id: string;
  declare name: string;
  channels: ('email' | 'push' | 'sms')[];
  email?: {
    subject?: string;
    body?: string;
    sender?: string;
  };
  push?: {
    title?: string;
    body?: string;
  };
  sms?: {
    message?: string;
  };
  variables?: string[];
  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
    super(database, CommunicationTemplate.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (CommunicationTemplate._instance) return CommunicationTemplate._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    CommunicationTemplate._instance = new CommunicationTemplate(database);
    return CommunicationTemplate._instance;
  }
}
