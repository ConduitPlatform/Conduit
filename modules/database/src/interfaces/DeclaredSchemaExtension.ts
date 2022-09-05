import { ConduitModel } from '@conduitplatform/grpc-sdk';

export type DeclaredSchemaExtension = {
  fields: ConduitModel;
  ownerModule: string;
  createdAt: Date;
  updatedAt: Date;
};
