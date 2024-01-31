import { ConduitModel, ConduitSchemaOptions } from '@conduitplatform/grpc-sdk';
import { DeclaredSchemaExtension } from './DeclaredSchemaExtension.js';

export interface IDeclaredSchema {
  _id: string;
  name: string;
  fields: ConduitModel;
  extensions: DeclaredSchemaExtension[];
  compiledFields: ConduitModel;
  modelOptions: ConduitSchemaOptions;
  createdAt: Date;
  updatedAt: Date;
}
