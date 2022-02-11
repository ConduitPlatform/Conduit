import { ConduitModelOptions } from '@conduitplatform/grpc-sdk';
import { DeclaredSchemaExtension } from './DeclaredSchemaExtension';

export interface IDeclaredSchema {
  _id: string;
  name: string;
  fields: any;
  extensions: DeclaredSchemaExtension[];
  modelOptions: ConduitModelOptions;
  createdAt: Date;
  updatedAt: Date;
}
