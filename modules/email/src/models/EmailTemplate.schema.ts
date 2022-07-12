import { ConduitActiveSchema, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';

const schema = {
  _id: TYPE.ObjectId,
  name: {
    type: TYPE.String,
    unique: true,
    required: true,
  },
  subject: {
    type: TYPE.String,
  },
  body: {
    type: TYPE.String,
    required: true,
  },
  variables: {
    type: [TYPE.String],
  },
  sender: {
    type: TYPE.String,
  },
  externalManaged: {
    type: TYPE.Boolean,
    default: false,
    required: true,
  },
  externalId: TYPE.String,
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};
const schemaOptions = {
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
const collectionName = 'cnd_emailtemplates';

export class EmailTemplate extends ConduitActiveSchema<EmailTemplate> {
  private static _instance: EmailTemplate;
  _id: string;
  name: string;
  subject?: string;
  body: string;
  variables?: string[];
  sender?: string;
  externalManaged: boolean;
  externalId?: string;
  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
    super(database, EmailTemplate.name, schema, schemaOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (EmailTemplate._instance) return EmailTemplate._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    EmailTemplate._instance = new EmailTemplate(database);
    return EmailTemplate._instance;
  }
}
