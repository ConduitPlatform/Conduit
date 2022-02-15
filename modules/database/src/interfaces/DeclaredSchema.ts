import { ConduitModelOptions } from '@conduitplatform/grpc-sdk';

export interface IDeclaredSchema {
  _id: string;
  name: string;
  fields: any;
  extensions: any[];
  modelOptions: ConduitModelOptions;
  createdAt: Date;
  updatedAt: Date;

}
