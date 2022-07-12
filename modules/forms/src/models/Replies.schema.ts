import { ConduitActiveSchema, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';
import { Forms } from './Forms.schema';

const schema = {
  _id: TYPE.ObjectId,
  form: {
    type: TYPE.Relation,
    model: 'Forms',
    required: true,
  },
  data: {
    type: TYPE.JSON,
    required: true,
  },
  possibleSpam: {
    type: TYPE.Boolean,
    default: false,
    required: true,
  },
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
const collectionName = 'cnd_replies';

export class FormReplies extends ConduitActiveSchema<FormReplies> {
  private static _instance: FormReplies;
  _id!: string;
  form!: string | Forms;
  data!: any;
  possibleSpam!: boolean;
  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
    super(database, FormReplies.name, schema, schemaOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (FormReplies._instance) return FormReplies._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    FormReplies._instance = new FormReplies(database);
    return FormReplies._instance;
  }
}
