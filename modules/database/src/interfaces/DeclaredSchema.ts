import { ConduitModel, ConduitSchemaOptions } from '@conduitplatform/grpc-sdk';
import { DeclaredSchemaExtension } from './DeclaredSchemaExtension';

export interface IDeclaredSchema {
  _id: string;
  name: string;
  fields: ConduitModel;
  extensions: DeclaredSchemaExtension[];
  modelOptions: ConduitSchemaOptions;
  createdAt: Date;
  updatedAt: Date;
}
