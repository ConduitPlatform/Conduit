import {
  ConduitActiveSchema,
  DatabaseProvider,
  TYPE,
} from '@quintessential-sft/conduit-grpc-sdk';

const schema = {
  _id: TYPE.ObjectId,
  name: {
    type: TYPE.String,
    unique: true,
    required: true,
    systemRequired: true,
  },
  subject: {
    type: TYPE.String,
    systemRequired: true,
  },
  body: {
    type: TYPE.String,
    required: true,
    systemRequired: true,
  },
  variables: {
    type: [TYPE.String],
    systemRequired: true,
  },
  sender:{
    type: TYPE.String,
    required: false,
  },
  externalManaged: {
    type: TYPE.Boolean,
    default:false,
  },
  externalId:{
    type:TYPE.String,
    required: false,
  },
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};
const schemaOptions = {
  timestamps: true,
  systemRequired: true,
};
const collectionName = undefined;

export class EmailTemplate extends ConduitActiveSchema<EmailTemplate> {
  private static _instance: EmailTemplate;
  _id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  sender: string;
  externalManaged: boolean;
  extarnalId: string;
  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
    super(database, EmailTemplate.name);
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
