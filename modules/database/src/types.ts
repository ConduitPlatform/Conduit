import { GrpcRequest, GrpcResponse } from '@conduitplatform/grpc-sdk';
import {
  Schema as SchemaDto,
  SchemaExtension as SchemaExtensionDto,
} from './protoTypes/database';

export type CreateSchemaRequest = GrpcRequest<SchemaDto>;

export type CreateSchemaExtensionRequest = GrpcRequest<{
  extension: SchemaExtensionDto;
}>;

export type GetSchemaRequest = GrpcRequest<{
  schemaName: string;
}>;

export type SchemaResponse = GrpcResponse<SchemaDto>;

export type GetSchemasRequest = GrpcRequest<{}>;

export type SchemasResponse = GrpcResponse<{
  schemas: SchemaDto[];
}>;

export type FindOneRequest = GrpcRequest<{
  schemaName: string;
  query: string;
  select: string;
  populate: string[];
}>;

export type FindRequest = GrpcRequest<{
  schemaName: string;
  query: string;
  select: string;
  skip: number;
  limit: number;
  sort: string;
  populate: string[];
}>;

export type QueryRequest = GrpcRequest<{
  schemaName: string;
  query: string;
}>;

export type DropCollectionResponse = GrpcResponse<{
  result: string;
}>;

export type DropCollectionRequest = GrpcRequest<{
  schemaName: string;
  deleteData: boolean;
}>;

export type QueryResponse = GrpcResponse<{
  result: string;
}>;

export type UpdateRequest = GrpcRequest<{
  schemaName: string;
  id: string;
  query: string;
  updateProvidedOnly?: boolean;
  populate?: string[];
}>;

export type UpdateManyRequest = GrpcRequest<{
  schemaName: string;
  filterQuery: string;
  query: string;
  updateProvidedOnly?: boolean;
}>;
