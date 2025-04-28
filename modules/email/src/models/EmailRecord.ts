import { ConduitModel, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';
import { EmailTemplate } from './EmailTemplate.schema.js';

const schema: ConduitModel = {
  _id: TYPE.ObjectId,
  messageId: {
    type: TYPE.String,
    required: false,
  },
  template: {
    type: TYPE.Relation,
    model: 'EmailTemplate',
    required: false,
  },
  contentFile: {
    type: TYPE.Relation,
    model: 'File',
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
  status: {
    type: TYPE.String,
    required: false,
    default: 'unknown',
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

export class EmailRecord extends ConduitActiveSchema<EmailRecord> {
  private static _instance: EmailRecord;
  _id: string;
  messageId?: string;
  template: string | EmailTemplate;
  contentFile: string;
  sender: string;
  receiver: string;
  cc?: string[];
  replyTo?: string;
  sendingDomain?: string;
  createdAt: Date;
  updatedAt: Date;
  status: string;

  private constructor(database: DatabaseProvider) {
    super(database, EmailRecord.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (EmailRecord._instance) return EmailRecord._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    EmailRecord._instance = new EmailRecord(database);
    return EmailRecord._instance;
  }
}
