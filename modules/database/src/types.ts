import { GrpcRequest, GrpcResponse } from '@quintessential-sft/conduit-grpc-sdk';

type Schema = {
  name: string;
  modelSchema: string;
  modelOptions: string;
  collectionName: string;
};

export type CreateSchemaRequest = GrpcRequest<{
  schema: Schema;
}>;

export type GetSchemaRequest = GrpcRequest<{
  schemaName: string;
}>;

export type SchemaResponse = GrpcResponse<{
  schema: Schema;
}>;

export type GetSchemasRequest = GrpcRequest<{}>;

export type SchemasResponse = GrpcResponse<{
  schemas: Schema[];
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

export type QueryResponse = GrpcResponse<{
  result: string;
}>;

export type UpdateRequest = GrpcRequest<{
  schemaName: string;
  id: string;
  query: string;
  updateProvidedOnly?: boolean;
  populate?: string[]
}>;

export type UpdateManyRequest = GrpcRequest<{
  schemaName: string;
  filterQuery: string;
  query: string;
  updateProvidedOnly?: boolean;
}>;
