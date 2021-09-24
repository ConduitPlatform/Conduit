import { SchemaModel } from '../../models/Schema.model';
import * as fs from 'fs-extra';
import { parseFieldsToTs } from './utils';

const MODEL_TEMPLATE = `
import {
  ConduitActiveSchema,
  DatabaseProvider,
} from '@quintessential-sft/conduit-grpc-sdk';

IMPORTS_PLACEHOLDER

export class MODEL_CLASS_NAME extends ConduitActiveSchema<MODEL_CLASS_NAME> {
  private static _instance: MODEL_CLASS_NAME;
  
  FIELDS_PLACEHOLDER

  constructor(database: DatabaseProvider) {
    super(database, MODEL_CLASS_NAME.name);
  }

  static getInstance(database?: DatabaseProvider) {
    if (MODEL_CLASS_NAME._instance) return MODEL_CLASS_NAME._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    MODEL_CLASS_NAME._instance = new MODEL_CLASS_NAME(database);
    return MODEL_CLASS_NAME._instance;
  }
}
`;

function generateText(schema: SchemaModel) {
  let usableText = MODEL_TEMPLATE.toString();
  let schemaName = schema.name.charAt(0).toUpperCase() + schema.name.slice(1);
  while (usableText.indexOf('MODEL_CLASS_NAME') !== -1) {
    usableText = usableText.replace('MODEL_CLASS_NAME', schemaName);
  }
  let parsing = parseFieldsToTs(schema.fields);

  usableText = usableText.replace('FIELDS_PLACEHOLDER', parsing.typings);
  usableText = usableText.replace('IMPORTS_PLACEHOLDER', parsing.imports);
  return usableText;
}

export async function generateSchema(schema: SchemaModel, path: string) {
  await fs.ensureDir(path);
  let schemaName = schema.name.charAt(0).toUpperCase() + schema.name.slice(1);
  schemaName += '.schema.ts';
  fs.writeFileSync(path + '/' + schemaName, generateText(schema));
}
