import { ConduitModel, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';

const schema: ConduitModel = {
  _id: TYPE.ObjectId,
  messageId: {
    type: TYPE.String,
    required: false,
  },
  recipient: {
    type: TYPE.String,
    required: true,
  },
  message: {
    type: TYPE.String,
    required: true,
  },
  provider: {
    type: TYPE.String,
    required: true,
  },
  status: {
    type: TYPE.String,
    enum: ['pending', 'sent', 'delivered', 'failed', 'bounced'],
    required: false,
    default: 'pending',
  },
  providerResponse: TYPE.JSON,
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

export class SmsRecord extends ConduitActiveSchema<SmsRecord> {
  private static _instance: SmsRecord;
  _id: string;
  messageId?: string;
  recipient: string;
  message: string;
  provider: string;
  status: string;
  providerResponse?: any;
  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
    super(database, SmsRecord.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (SmsRecord._instance) return SmsRecord._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    SmsRecord._instance = new SmsRecord(database);
    return SmsRecord._instance;
  }
}
