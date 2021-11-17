import {
  ConduitActiveSchema,
  DatabaseProvider,
  TYPE,
} from '@quintessential-sft/conduit-grpc-sdk';
import { Forms } from './Forms.schema'

const schema = {
  _id: TYPE.ObjectId,
  form: {
    type: TYPE.Relation,
    model: 'Forms',
    required: true,
    systemRequired: true,
  },
  data: {
    type: TYPE.JSON,
    required: true,
    systemRequired: true,
  },
  possibleSpam: {
    type: TYPE.Boolean,
    default: false,
  },
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};
const schemaOptions = {
  timestamps: true,
  systemRequired: true,
};
const collectionName = undefined;

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
