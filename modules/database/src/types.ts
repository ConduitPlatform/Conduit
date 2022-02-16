import { GrpcRequest, GrpcResponse } from '@conduitplatform/grpc-sdk';

type Schema = {
  name: string;
  modelSchema: string;
  modelOptions: string;
  collectionName: string;
};

type SchemaExtension = {
  name: string;
  modelSchema: string;
};

export type CreateSchemaRequest = GrpcRequest<{
  schema: Schema;
}>;

export type CreateSchemaExtensionRequest = GrpcRequest<{
  extension: SchemaExtension;
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

export type DropCollectionResponse = GrpcResponse<{
  result: string;
}>

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
  populate?: string[]
}>;

export type UpdateManyRequest = GrpcRequest<{
  schemaName: string;
  filterQuery: string;
  query: string;
  updateProvidedOnly?: boolean;
}>;
