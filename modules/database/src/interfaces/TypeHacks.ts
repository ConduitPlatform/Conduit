import {
  ConduitSchema,
  ConduitSchemaOptions,
  ConduitModel,
} from '@conduitplatform/grpc-sdk';
import { DeclaredSchemaExtension } from './DeclaredSchemaExtension';

// @dirty-type-cast

export type _ConduitSchema = Omit<ConduitSchema, 'collectionName'> & {
  extensions: DeclaredSchemaExtension[];
  compiledFields: ConduitModel;
  collectionName: string;
};

export type _ConduitSchemaOptions = ConduitSchemaOptions & { collection: string };
