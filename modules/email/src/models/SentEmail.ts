import { ConduitModel, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';

const schema: ConduitModel = {
  _id: TYPE.ObjectId,
  messageId: {
    type: TYPE.String,
    required: false,
  },
  sender: {
    type: TYPE.String,
    required: false,
  },
  receiver: {
    type: TYPE.String,
    required: true,
  },
  cc: {
    type: [TYPE.String],
    required: false,
  },
  replyTo: {
    type: TYPE.String,
    required: false,
  },
  sendingDomain: {
    type: TYPE.String,
    required: false,
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

export class SentEmail extends ConduitActiveSchema<SentEmail> {
  private static _instance: SentEmail;
  _id: string;
  messageId?: string;
  sender: string;
  receiver: string;
  cc?: string[];
  replyTo?: string;
  sendingDomain?: string;
  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
    super(database, SentEmail.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (SentEmail._instance) return SentEmail._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    SentEmail._instance = new SentEmail(database);
    return SentEmail._instance;
  }
}
