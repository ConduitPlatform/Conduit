/* eslint-disable */
import Long from 'long';
import {
  makeGenericClientConstructor,
  ChannelCredentials,
  ChannelOptions,
  UntypedServiceImplementation,
  handleUnaryCall,
  Client,
  ClientUnaryCall,
  Metadata,
  CallOptions,
  ServiceError,
} from '@grpc/grpc-js';
import _m0 from 'protobufjs/minimal';

export const protobufPackage = 'databaseprovider';

export interface CreateSchemaRequest {
  schema?: Schema;
}

export interface CreateSchemaResponse {
  schema?: Schema;
}

export interface GetSchemaRequest {
  schemaName: string;
}

export interface GetSchemaResponse {
  schema?: Schema;
}

export interface GetSchemasRequest {}

export interface GetSchemasResponse {
  schemas: Schema[];
}

export interface Schema {
  name: string;
  modelSchema: string;
  modelOptions: string;
}

export interface FindOneRequest {
  schemaName: string;
  query: string;
  select?: string | undefined;
  populate: string[];
}

export interface FindRequest {
  schemaName: string;
  query: string;
  select?: string | undefined;
  skip?: number | undefined;
  limit?: number | undefined;
  sort?: string | undefined;
  populate: string[];
}

export interface QueryResponse {
  result: string;
}

export interface QueryRequest {
  schemaName: string;
  query: string;
}

export interface UpdateRequest {
  schemaName: string;
  id: string;
  query: string;
  updateProvidedOnly?: boolean | undefined;
}

export interface UpdateManyRequest {
  schemaName: string;
  filterQuery: string;
  query: string;
  updateProvidedOnly?: boolean | undefined;
}

const baseCreateSchemaRequest: object = {};

export const CreateSchemaRequest = {
  encode(
    message: CreateSchemaRequest,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.schema !== undefined) {
      Schema.encode(message.schema, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CreateSchemaRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseCreateSchemaRequest } as CreateSchemaRequest;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.schema = Schema.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): CreateSchemaRequest {
    const message = { ...baseCreateSchemaRequest } as CreateSchemaRequest;
    if (object.schema !== undefined && object.schema !== null) {
      message.schema = Schema.fromJSON(object.schema);
    } else {
      message.schema = undefined;
    }
    return message;
  },

  toJSON(message: CreateSchemaRequest): unknown {
    const obj: any = {};
    message.schema !== undefined &&
      (obj.schema = message.schema ? Schema.toJSON(message.schema) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<CreateSchemaRequest>): CreateSchemaRequest {
    const message = { ...baseCreateSchemaRequest } as CreateSchemaRequest;
    if (object.schema !== undefined && object.schema !== null) {
      message.schema = Schema.fromPartial(object.schema);
    } else {
      message.schema = undefined;
    }
    return message;
  },
};

const baseCreateSchemaResponse: object = {};

export const CreateSchemaResponse = {
  encode(
    message: CreateSchemaResponse,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.schema !== undefined) {
      Schema.encode(message.schema, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CreateSchemaResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseCreateSchemaResponse } as CreateSchemaResponse;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.schema = Schema.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): CreateSchemaResponse {
    const message = { ...baseCreateSchemaResponse } as CreateSchemaResponse;
    if (object.schema !== undefined && object.schema !== null) {
      message.schema = Schema.fromJSON(object.schema);
    } else {
      message.schema = undefined;
    }
    return message;
  },

  toJSON(message: CreateSchemaResponse): unknown {
    const obj: any = {};
    message.schema !== undefined &&
      (obj.schema = message.schema ? Schema.toJSON(message.schema) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<CreateSchemaResponse>): CreateSchemaResponse {
    const message = { ...baseCreateSchemaResponse } as CreateSchemaResponse;
    if (object.schema !== undefined && object.schema !== null) {
      message.schema = Schema.fromPartial(object.schema);
    } else {
      message.schema = undefined;
    }
    return message;
  },
};

const baseGetSchemaRequest: object = { schemaName: '' };

export const GetSchemaRequest = {
  encode(
    message: GetSchemaRequest,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.schemaName !== '') {
      writer.uint32(10).string(message.schemaName);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetSchemaRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseGetSchemaRequest } as GetSchemaRequest;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.schemaName = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): GetSchemaRequest {
    const message = { ...baseGetSchemaRequest } as GetSchemaRequest;
    if (object.schemaName !== undefined && object.schemaName !== null) {
      message.schemaName = String(object.schemaName);
    } else {
      message.schemaName = '';
    }
    return message;
  },

  toJSON(message: GetSchemaRequest): unknown {
    const obj: any = {};
    message.schemaName !== undefined && (obj.schemaName = message.schemaName);
    return obj;
  },

  fromPartial(object: DeepPartial<GetSchemaRequest>): GetSchemaRequest {
    const message = { ...baseGetSchemaRequest } as GetSchemaRequest;
    if (object.schemaName !== undefined && object.schemaName !== null) {
      message.schemaName = object.schemaName;
    } else {
      message.schemaName = '';
    }
    return message;
  },
};

const baseGetSchemaResponse: object = {};

export const GetSchemaResponse = {
  encode(
    message: GetSchemaResponse,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.schema !== undefined) {
      Schema.encode(message.schema, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetSchemaResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseGetSchemaResponse } as GetSchemaResponse;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.schema = Schema.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): GetSchemaResponse {
    const message = { ...baseGetSchemaResponse } as GetSchemaResponse;
    if (object.schema !== undefined && object.schema !== null) {
      message.schema = Schema.fromJSON(object.schema);
    } else {
      message.schema = undefined;
    }
    return message;
  },

  toJSON(message: GetSchemaResponse): unknown {
    const obj: any = {};
    message.schema !== undefined &&
      (obj.schema = message.schema ? Schema.toJSON(message.schema) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<GetSchemaResponse>): GetSchemaResponse {
    const message = { ...baseGetSchemaResponse } as GetSchemaResponse;
    if (object.schema !== undefined && object.schema !== null) {
      message.schema = Schema.fromPartial(object.schema);
    } else {
      message.schema = undefined;
    }
    return message;
  },
};

const baseGetSchemasRequest: object = {};

export const GetSchemasRequest = {
  encode(_: GetSchemasRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetSchemasRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseGetSchemasRequest } as GetSchemasRequest;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(_: any): GetSchemasRequest {
    const message = { ...baseGetSchemasRequest } as GetSchemasRequest;
    return message;
  },

  toJSON(_: GetSchemasRequest): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial(_: DeepPartial<GetSchemasRequest>): GetSchemasRequest {
    const message = { ...baseGetSchemasRequest } as GetSchemasRequest;
    return message;
  },
};

const baseGetSchemasResponse: object = {};

export const GetSchemasResponse = {
  encode(
    message: GetSchemasResponse,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    for (const v of message.schemas) {
      Schema.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetSchemasResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseGetSchemasResponse } as GetSchemasResponse;
    message.schemas = [];
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.schemas.push(Schema.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): GetSchemasResponse {
    const message = { ...baseGetSchemasResponse } as GetSchemasResponse;
    message.schemas = [];
    if (object.schemas !== undefined && object.schemas !== null) {
      for (const e of object.schemas) {
        message.schemas.push(Schema.fromJSON(e));
      }
    }
    return message;
  },

  toJSON(message: GetSchemasResponse): unknown {
    const obj: any = {};
    if (message.schemas) {
      obj.schemas = message.schemas.map((e) => (e ? Schema.toJSON(e) : undefined));
    } else {
      obj.schemas = [];
    }
    return obj;
  },

  fromPartial(object: DeepPartial<GetSchemasResponse>): GetSchemasResponse {
    const message = { ...baseGetSchemasResponse } as GetSchemasResponse;
    message.schemas = [];
    if (object.schemas !== undefined && object.schemas !== null) {
      for (const e of object.schemas) {
        message.schemas.push(Schema.fromPartial(e));
      }
    }
    return message;
  },
};

const baseSchema: object = { name: '', modelSchema: '', modelOptions: '' };

export const Schema = {
  encode(message: Schema, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.name !== '') {
      writer.uint32(10).string(message.name);
    }
    if (message.modelSchema !== '') {
      writer.uint32(18).string(message.modelSchema);
    }
    if (message.modelOptions !== '') {
      writer.uint32(26).string(message.modelOptions);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Schema {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseSchema } as Schema;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.name = reader.string();
          break;
        case 2:
          message.modelSchema = reader.string();
          break;
        case 3:
          message.modelOptions = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): Schema {
    const message = { ...baseSchema } as Schema;
    if (object.name !== undefined && object.name !== null) {
      message.name = String(object.name);
    } else {
      message.name = '';
    }
    if (object.modelSchema !== undefined && object.modelSchema !== null) {
      message.modelSchema = String(object.modelSchema);
    } else {
      message.modelSchema = '';
    }
    if (object.modelOptions !== undefined && object.modelOptions !== null) {
      message.modelOptions = String(object.modelOptions);
    } else {
      message.modelOptions = '';
    }
    return message;
  },

  toJSON(message: Schema): unknown {
    const obj: any = {};
    message.name !== undefined && (obj.name = message.name);
    message.modelSchema !== undefined && (obj.modelSchema = message.modelSchema);
    message.modelOptions !== undefined && (obj.modelOptions = message.modelOptions);
    return obj;
  },

  fromPartial(object: DeepPartial<Schema>): Schema {
    const message = { ...baseSchema } as Schema;
    if (object.name !== undefined && object.name !== null) {
      message.name = object.name;
    } else {
      message.name = '';
    }
    if (object.modelSchema !== undefined && object.modelSchema !== null) {
      message.modelSchema = object.modelSchema;
    } else {
      message.modelSchema = '';
    }
    if (object.modelOptions !== undefined && object.modelOptions !== null) {
      message.modelOptions = object.modelOptions;
    } else {
      message.modelOptions = '';
    }
    return message;
  },
};

const baseFindOneRequest: object = { schemaName: '', query: '', populate: '' };

export const FindOneRequest = {
  encode(message: FindOneRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.schemaName !== '') {
      writer.uint32(10).string(message.schemaName);
    }
    if (message.query !== '') {
      writer.uint32(18).string(message.query);
    }
    if (message.select !== undefined) {
      writer.uint32(26).string(message.select);
    }
    for (const v of message.populate) {
      writer.uint32(34).string(v!);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): FindOneRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseFindOneRequest } as FindOneRequest;
    message.populate = [];
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.schemaName = reader.string();
          break;
        case 2:
          message.query = reader.string();
          break;
        case 3:
          message.select = reader.string();
          break;
        case 4:
          message.populate.push(reader.string());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): FindOneRequest {
    const message = { ...baseFindOneRequest } as FindOneRequest;
    message.populate = [];
    if (object.schemaName !== undefined && object.schemaName !== null) {
      message.schemaName = String(object.schemaName);
    } else {
      message.schemaName = '';
    }
    if (object.query !== undefined && object.query !== null) {
      message.query = String(object.query);
    } else {
      message.query = '';
    }
    if (object.select !== undefined && object.select !== null) {
      message.select = String(object.select);
    } else {
      message.select = undefined;
    }
    if (object.populate !== undefined && object.populate !== null) {
      for (const e of object.populate) {
        message.populate.push(String(e));
      }
    }
    return message;
  },

  toJSON(message: FindOneRequest): unknown {
    const obj: any = {};
    message.schemaName !== undefined && (obj.schemaName = message.schemaName);
    message.query !== undefined && (obj.query = message.query);
    message.select !== undefined && (obj.select = message.select);
    if (message.populate) {
      obj.populate = message.populate.map((e) => e);
    } else {
      obj.populate = [];
    }
    return obj;
  },

  fromPartial(object: DeepPartial<FindOneRequest>): FindOneRequest {
    const message = { ...baseFindOneRequest } as FindOneRequest;
    message.populate = [];
    if (object.schemaName !== undefined && object.schemaName !== null) {
      message.schemaName = object.schemaName;
    } else {
      message.schemaName = '';
    }
    if (object.query !== undefined && object.query !== null) {
      message.query = object.query;
    } else {
      message.query = '';
    }
    if (object.select !== undefined && object.select !== null) {
      message.select = object.select;
    } else {
      message.select = undefined;
    }
    if (object.populate !== undefined && object.populate !== null) {
      for (const e of object.populate) {
        message.populate.push(e);
      }
    }
    return message;
  },
};

const baseFindRequest: object = { schemaName: '', query: '', populate: '' };

export const FindRequest = {
  encode(message: FindRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.schemaName !== '') {
      writer.uint32(10).string(message.schemaName);
    }
    if (message.query !== '') {
      writer.uint32(18).string(message.query);
    }
    if (message.select !== undefined) {
      writer.uint32(26).string(message.select);
    }
    if (message.skip !== undefined) {
      writer.uint32(32).int32(message.skip);
    }
    if (message.limit !== undefined) {
      writer.uint32(40).int32(message.limit);
    }
    if (message.sort !== undefined) {
      writer.uint32(50).string(message.sort);
    }
    for (const v of message.populate) {
      writer.uint32(58).string(v!);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): FindRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseFindRequest } as FindRequest;
    message.populate = [];
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.schemaName = reader.string();
          break;
        case 2:
          message.query = reader.string();
          break;
        case 3:
          message.select = reader.string();
          break;
        case 4:
          message.skip = reader.int32();
          break;
        case 5:
          message.limit = reader.int32();
          break;
        case 6:
          message.sort = reader.string();
          break;
        case 7:
          message.populate.push(reader.string());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): FindRequest {
    const message = { ...baseFindRequest } as FindRequest;
    message.populate = [];
    if (object.schemaName !== undefined && object.schemaName !== null) {
      message.schemaName = String(object.schemaName);
    } else {
      message.schemaName = '';
    }
    if (object.query !== undefined && object.query !== null) {
      message.query = String(object.query);
    } else {
      message.query = '';
    }
    if (object.select !== undefined && object.select !== null) {
      message.select = String(object.select);
    } else {
      message.select = undefined;
    }
    if (object.skip !== undefined && object.skip !== null) {
      message.skip = Number(object.skip);
    } else {
      message.skip = undefined;
    }
    if (object.limit !== undefined && object.limit !== null) {
      message.limit = Number(object.limit);
    } else {
      message.limit = undefined;
    }
    if (object.sort !== undefined && object.sort !== null) {
      message.sort = String(object.sort);
    } else {
      message.sort = undefined;
    }
    if (object.populate !== undefined && object.populate !== null) {
      for (const e of object.populate) {
        message.populate.push(String(e));
      }
    }
    return message;
  },

  toJSON(message: FindRequest): unknown {
    const obj: any = {};
    message.schemaName !== undefined && (obj.schemaName = message.schemaName);
    message.query !== undefined && (obj.query = message.query);
    message.select !== undefined && (obj.select = message.select);
    message.skip !== undefined && (obj.skip = message.skip);
    message.limit !== undefined && (obj.limit = message.limit);
    message.sort !== undefined && (obj.sort = message.sort);
    if (message.populate) {
      obj.populate = message.populate.map((e) => e);
    } else {
      obj.populate = [];
    }
    return obj;
  },

  fromPartial(object: DeepPartial<FindRequest>): FindRequest {
    const message = { ...baseFindRequest } as FindRequest;
    message.populate = [];
    if (object.schemaName !== undefined && object.schemaName !== null) {
      message.schemaName = object.schemaName;
    } else {
      message.schemaName = '';
    }
    if (object.query !== undefined && object.query !== null) {
      message.query = object.query;
    } else {
      message.query = '';
    }
    if (object.select !== undefined && object.select !== null) {
      message.select = object.select;
    } else {
      message.select = undefined;
    }
    if (object.skip !== undefined && object.skip !== null) {
      message.skip = object.skip;
    } else {
      message.skip = undefined;
    }
    if (object.limit !== undefined && object.limit !== null) {
      message.limit = object.limit;
    } else {
      message.limit = undefined;
    }
    if (object.sort !== undefined && object.sort !== null) {
      message.sort = object.sort;
    } else {
      message.sort = undefined;
    }
    if (object.populate !== undefined && object.populate !== null) {
      for (const e of object.populate) {
        message.populate.push(e);
      }
    }
    return message;
  },
};

const baseQueryResponse: object = { result: '' };

export const QueryResponse = {
  encode(message: QueryResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.result !== '') {
      writer.uint32(10).string(message.result);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseQueryResponse } as QueryResponse;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.result = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): QueryResponse {
    const message = { ...baseQueryResponse } as QueryResponse;
    if (object.result !== undefined && object.result !== null) {
      message.result = String(object.result);
    } else {
      message.result = '';
    }
    return message;
  },

  toJSON(message: QueryResponse): unknown {
    const obj: any = {};
    message.result !== undefined && (obj.result = message.result);
    return obj;
  },

  fromPartial(object: DeepPartial<QueryResponse>): QueryResponse {
    const message = { ...baseQueryResponse } as QueryResponse;
    if (object.result !== undefined && object.result !== null) {
      message.result = object.result;
    } else {
      message.result = '';
    }
    return message;
  },
};

const baseQueryRequest: object = { schemaName: '', query: '' };

export const QueryRequest = {
  encode(message: QueryRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.schemaName !== '') {
      writer.uint32(10).string(message.schemaName);
    }
    if (message.query !== '') {
      writer.uint32(18).string(message.query);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseQueryRequest } as QueryRequest;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.schemaName = reader.string();
          break;
        case 2:
          message.query = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): QueryRequest {
    const message = { ...baseQueryRequest } as QueryRequest;
    if (object.schemaName !== undefined && object.schemaName !== null) {
      message.schemaName = String(object.schemaName);
    } else {
      message.schemaName = '';
    }
    if (object.query !== undefined && object.query !== null) {
      message.query = String(object.query);
    } else {
      message.query = '';
    }
    return message;
  },

  toJSON(message: QueryRequest): unknown {
    const obj: any = {};
    message.schemaName !== undefined && (obj.schemaName = message.schemaName);
    message.query !== undefined && (obj.query = message.query);
    return obj;
  },

  fromPartial(object: DeepPartial<QueryRequest>): QueryRequest {
    const message = { ...baseQueryRequest } as QueryRequest;
    if (object.schemaName !== undefined && object.schemaName !== null) {
      message.schemaName = object.schemaName;
    } else {
      message.schemaName = '';
    }
    if (object.query !== undefined && object.query !== null) {
      message.query = object.query;
    } else {
      message.query = '';
    }
    return message;
  },
};

const baseUpdateRequest: object = { schemaName: '', id: '', query: '' };

export const UpdateRequest = {
  encode(message: UpdateRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.schemaName !== '') {
      writer.uint32(10).string(message.schemaName);
    }
    if (message.id !== '') {
      writer.uint32(18).string(message.id);
    }
    if (message.query !== '') {
      writer.uint32(26).string(message.query);
    }
    if (message.updateProvidedOnly !== undefined) {
      writer.uint32(32).bool(message.updateProvidedOnly);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): UpdateRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseUpdateRequest } as UpdateRequest;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.schemaName = reader.string();
          break;
        case 2:
          message.id = reader.string();
          break;
        case 3:
          message.query = reader.string();
          break;
        case 4:
          message.updateProvidedOnly = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): UpdateRequest {
    const message = { ...baseUpdateRequest } as UpdateRequest;
    if (object.schemaName !== undefined && object.schemaName !== null) {
      message.schemaName = String(object.schemaName);
    } else {
      message.schemaName = '';
    }
    if (object.id !== undefined && object.id !== null) {
      message.id = String(object.id);
    } else {
      message.id = '';
    }
    if (object.query !== undefined && object.query !== null) {
      message.query = String(object.query);
    } else {
      message.query = '';
    }
    if (object.updateProvidedOnly !== undefined && object.updateProvidedOnly !== null) {
      message.updateProvidedOnly = Boolean(object.updateProvidedOnly);
    } else {
      message.updateProvidedOnly = undefined;
    }
    return message;
  },

  toJSON(message: UpdateRequest): unknown {
    const obj: any = {};
    message.schemaName !== undefined && (obj.schemaName = message.schemaName);
    message.id !== undefined && (obj.id = message.id);
    message.query !== undefined && (obj.query = message.query);
    message.updateProvidedOnly !== undefined &&
      (obj.updateProvidedOnly = message.updateProvidedOnly);
    return obj;
  },

  fromPartial(object: DeepPartial<UpdateRequest>): UpdateRequest {
    const message = { ...baseUpdateRequest } as UpdateRequest;
    if (object.schemaName !== undefined && object.schemaName !== null) {
      message.schemaName = object.schemaName;
    } else {
      message.schemaName = '';
    }
    if (object.id !== undefined && object.id !== null) {
      message.id = object.id;
    } else {
      message.id = '';
    }
    if (object.query !== undefined && object.query !== null) {
      message.query = object.query;
    } else {
      message.query = '';
    }
    if (object.updateProvidedOnly !== undefined && object.updateProvidedOnly !== null) {
      message.updateProvidedOnly = object.updateProvidedOnly;
    } else {
      message.updateProvidedOnly = undefined;
    }
    return message;
  },
};

const baseUpdateManyRequest: object = { schemaName: '', filterQuery: '', query: '' };

export const UpdateManyRequest = {
  encode(
    message: UpdateManyRequest,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.schemaName !== '') {
      writer.uint32(10).string(message.schemaName);
    }
    if (message.filterQuery !== '') {
      writer.uint32(18).string(message.filterQuery);
    }
    if (message.query !== '') {
      writer.uint32(26).string(message.query);
    }
    if (message.updateProvidedOnly !== undefined) {
      writer.uint32(32).bool(message.updateProvidedOnly);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): UpdateManyRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseUpdateManyRequest } as UpdateManyRequest;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.schemaName = reader.string();
          break;
        case 2:
          message.filterQuery = reader.string();
          break;
        case 3:
          message.query = reader.string();
          break;
        case 4:
          message.updateProvidedOnly = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): UpdateManyRequest {
    const message = { ...baseUpdateManyRequest } as UpdateManyRequest;
    if (object.schemaName !== undefined && object.schemaName !== null) {
      message.schemaName = String(object.schemaName);
    } else {
      message.schemaName = '';
    }
    if (object.filterQuery !== undefined && object.filterQuery !== null) {
      message.filterQuery = String(object.filterQuery);
    } else {
      message.filterQuery = '';
    }
    if (object.query !== undefined && object.query !== null) {
      message.query = String(object.query);
    } else {
      message.query = '';
    }
    if (object.updateProvidedOnly !== undefined && object.updateProvidedOnly !== null) {
      message.updateProvidedOnly = Boolean(object.updateProvidedOnly);
    } else {
      message.updateProvidedOnly = undefined;
    }
    return message;
  },

  toJSON(message: UpdateManyRequest): unknown {
    const obj: any = {};
    message.schemaName !== undefined && (obj.schemaName = message.schemaName);
    message.filterQuery !== undefined && (obj.filterQuery = message.filterQuery);
    message.query !== undefined && (obj.query = message.query);
    message.updateProvidedOnly !== undefined &&
      (obj.updateProvidedOnly = message.updateProvidedOnly);
    return obj;
  },

  fromPartial(object: DeepPartial<UpdateManyRequest>): UpdateManyRequest {
    const message = { ...baseUpdateManyRequest } as UpdateManyRequest;
    if (object.schemaName !== undefined && object.schemaName !== null) {
      message.schemaName = object.schemaName;
    } else {
      message.schemaName = '';
    }
    if (object.filterQuery !== undefined && object.filterQuery !== null) {
      message.filterQuery = object.filterQuery;
    } else {
      message.filterQuery = '';
    }
    if (object.query !== undefined && object.query !== null) {
      message.query = object.query;
    } else {
      message.query = '';
    }
    if (object.updateProvidedOnly !== undefined && object.updateProvidedOnly !== null) {
      message.updateProvidedOnly = object.updateProvidedOnly;
    } else {
      message.updateProvidedOnly = undefined;
    }
    return message;
  },
};

export const DatabaseProviderService = {
  createSchemaFromAdapter: {
    path: '/databaseprovider.DatabaseProvider/CreateSchemaFromAdapter',
    requestStream: false,
    responseStream: false,
    requestSerialize: (value: CreateSchemaRequest) =>
      Buffer.from(CreateSchemaRequest.encode(value).finish()),
    requestDeserialize: (value: Buffer) => CreateSchemaRequest.decode(value),
    responseSerialize: (value: CreateSchemaResponse) =>
      Buffer.from(CreateSchemaResponse.encode(value).finish()),
    responseDeserialize: (value: Buffer) => CreateSchemaResponse.decode(value),
  },
  getSchema: {
    path: '/databaseprovider.DatabaseProvider/GetSchema',
    requestStream: false,
    responseStream: false,
    requestSerialize: (value: GetSchemaRequest) =>
      Buffer.from(GetSchemaRequest.encode(value).finish()),
    requestDeserialize: (value: Buffer) => GetSchemaRequest.decode(value),
    responseSerialize: (value: GetSchemaResponse) =>
      Buffer.from(GetSchemaResponse.encode(value).finish()),
    responseDeserialize: (value: Buffer) => GetSchemaResponse.decode(value),
  },
  getSchemas: {
    path: '/databaseprovider.DatabaseProvider/GetSchemas',
    requestStream: false,
    responseStream: false,
    requestSerialize: (value: GetSchemasRequest) =>
      Buffer.from(GetSchemasRequest.encode(value).finish()),
    requestDeserialize: (value: Buffer) => GetSchemasRequest.decode(value),
    responseSerialize: (value: GetSchemasResponse) =>
      Buffer.from(GetSchemasResponse.encode(value).finish()),
    responseDeserialize: (value: Buffer) => GetSchemasResponse.decode(value),
  },
  /** Database queries */
  findOne: {
    path: '/databaseprovider.DatabaseProvider/findOne',
    requestStream: false,
    responseStream: false,
    requestSerialize: (value: FindOneRequest) =>
      Buffer.from(FindOneRequest.encode(value).finish()),
    requestDeserialize: (value: Buffer) => FindOneRequest.decode(value),
    responseSerialize: (value: QueryResponse) =>
      Buffer.from(QueryResponse.encode(value).finish()),
    responseDeserialize: (value: Buffer) => QueryResponse.decode(value),
  },
  findMany: {
    path: '/databaseprovider.DatabaseProvider/findMany',
    requestStream: false,
    responseStream: false,
    requestSerialize: (value: FindRequest) =>
      Buffer.from(FindRequest.encode(value).finish()),
    requestDeserialize: (value: Buffer) => FindRequest.decode(value),
    responseSerialize: (value: QueryResponse) =>
      Buffer.from(QueryResponse.encode(value).finish()),
    responseDeserialize: (value: Buffer) => QueryResponse.decode(value),
  },
  create: {
    path: '/databaseprovider.DatabaseProvider/create',
    requestStream: false,
    responseStream: false,
    requestSerialize: (value: QueryRequest) =>
      Buffer.from(QueryRequest.encode(value).finish()),
    requestDeserialize: (value: Buffer) => QueryRequest.decode(value),
    responseSerialize: (value: QueryResponse) =>
      Buffer.from(QueryResponse.encode(value).finish()),
    responseDeserialize: (value: Buffer) => QueryResponse.decode(value),
  },
  createMany: {
    path: '/databaseprovider.DatabaseProvider/createMany',
    requestStream: false,
    responseStream: false,
    requestSerialize: (value: QueryRequest) =>
      Buffer.from(QueryRequest.encode(value).finish()),
    requestDeserialize: (value: Buffer) => QueryRequest.decode(value),
    responseSerialize: (value: QueryResponse) =>
      Buffer.from(QueryResponse.encode(value).finish()),
    responseDeserialize: (value: Buffer) => QueryResponse.decode(value),
  },
  deleteOne: {
    path: '/databaseprovider.DatabaseProvider/deleteOne',
    requestStream: false,
    responseStream: false,
    requestSerialize: (value: QueryRequest) =>
      Buffer.from(QueryRequest.encode(value).finish()),
    requestDeserialize: (value: Buffer) => QueryRequest.decode(value),
    responseSerialize: (value: QueryResponse) =>
      Buffer.from(QueryResponse.encode(value).finish()),
    responseDeserialize: (value: Buffer) => QueryResponse.decode(value),
  },
  deleteMany: {
    path: '/databaseprovider.DatabaseProvider/deleteMany',
    requestStream: false,
    responseStream: false,
    requestSerialize: (value: QueryRequest) =>
      Buffer.from(QueryRequest.encode(value).finish()),
    requestDeserialize: (value: Buffer) => QueryRequest.decode(value),
    responseSerialize: (value: QueryResponse) =>
      Buffer.from(QueryResponse.encode(value).finish()),
    responseDeserialize: (value: Buffer) => QueryResponse.decode(value),
  },
  findByIdAndUpdate: {
    path: '/databaseprovider.DatabaseProvider/findByIdAndUpdate',
    requestStream: false,
    responseStream: false,
    requestSerialize: (value: UpdateRequest) =>
      Buffer.from(UpdateRequest.encode(value).finish()),
    requestDeserialize: (value: Buffer) => UpdateRequest.decode(value),
    responseSerialize: (value: QueryResponse) =>
      Buffer.from(QueryResponse.encode(value).finish()),
    responseDeserialize: (value: Buffer) => QueryResponse.decode(value),
  },
  updateMany: {
    path: '/databaseprovider.DatabaseProvider/updateMany',
    requestStream: false,
    responseStream: false,
    requestSerialize: (value: UpdateManyRequest) =>
      Buffer.from(UpdateManyRequest.encode(value).finish()),
    requestDeserialize: (value: Buffer) => UpdateManyRequest.decode(value),
    responseSerialize: (value: QueryResponse) =>
      Buffer.from(QueryResponse.encode(value).finish()),
    responseDeserialize: (value: Buffer) => QueryResponse.decode(value),
  },
  countDocuments: {
    path: '/databaseprovider.DatabaseProvider/countDocuments',
    requestStream: false,
    responseStream: false,
    requestSerialize: (value: QueryRequest) =>
      Buffer.from(QueryRequest.encode(value).finish()),
    requestDeserialize: (value: Buffer) => QueryRequest.decode(value),
    responseSerialize: (value: QueryResponse) =>
      Buffer.from(QueryResponse.encode(value).finish()),
    responseDeserialize: (value: Buffer) => QueryResponse.decode(value),
  },
} as const;

export interface DatabaseProviderServer extends UntypedServiceImplementation {
  createSchemaFromAdapter: handleUnaryCall<CreateSchemaRequest, CreateSchemaResponse>;
  getSchema: handleUnaryCall<GetSchemaRequest, GetSchemaResponse>;
  getSchemas: handleUnaryCall<GetSchemasRequest, GetSchemasResponse>;
  /** Database queries */
  findOne: handleUnaryCall<FindOneRequest, QueryResponse>;
  findMany: handleUnaryCall<FindRequest, QueryResponse>;
  create: handleUnaryCall<QueryRequest, QueryResponse>;
  createMany: handleUnaryCall<QueryRequest, QueryResponse>;
  deleteOne: handleUnaryCall<QueryRequest, QueryResponse>;
  deleteMany: handleUnaryCall<QueryRequest, QueryResponse>;
  findByIdAndUpdate: handleUnaryCall<UpdateRequest, QueryResponse>;
  updateMany: handleUnaryCall<UpdateManyRequest, QueryResponse>;
  countDocuments: handleUnaryCall<QueryRequest, QueryResponse>;
}

export interface DatabaseProviderClient extends Client {
  createSchemaFromAdapter(
    request: CreateSchemaRequest,
    callback: (error: ServiceError | null, response: CreateSchemaResponse) => void
  ): ClientUnaryCall;
  createSchemaFromAdapter(
    request: CreateSchemaRequest,
    metadata: Metadata,
    callback: (error: ServiceError | null, response: CreateSchemaResponse) => void
  ): ClientUnaryCall;
  createSchemaFromAdapter(
    request: CreateSchemaRequest,
    metadata: Metadata,
    options: Partial<CallOptions>,
    callback: (error: ServiceError | null, response: CreateSchemaResponse) => void
  ): ClientUnaryCall;
  getSchema(
    request: GetSchemaRequest,
    callback: (error: ServiceError | null, response: GetSchemaResponse) => void
  ): ClientUnaryCall;
  getSchema(
    request: GetSchemaRequest,
    metadata: Metadata,
    callback: (error: ServiceError | null, response: GetSchemaResponse) => void
  ): ClientUnaryCall;
  getSchema(
    request: GetSchemaRequest,
    metadata: Metadata,
    options: Partial<CallOptions>,
    callback: (error: ServiceError | null, response: GetSchemaResponse) => void
  ): ClientUnaryCall;
  getSchemas(
    request: GetSchemasRequest,
    callback: (error: ServiceError | null, response: GetSchemasResponse) => void
  ): ClientUnaryCall;
  getSchemas(
    request: GetSchemasRequest,
    metadata: Metadata,
    callback: (error: ServiceError | null, response: GetSchemasResponse) => void
  ): ClientUnaryCall;
  getSchemas(
    request: GetSchemasRequest,
    metadata: Metadata,
    options: Partial<CallOptions>,
    callback: (error: ServiceError | null, response: GetSchemasResponse) => void
  ): ClientUnaryCall;
  /** Database queries */
  findOne(
    request: FindOneRequest,
    callback: (error: ServiceError | null, response: QueryResponse) => void
  ): ClientUnaryCall;
  findOne(
    request: FindOneRequest,
    metadata: Metadata,
    callback: (error: ServiceError | null, response: QueryResponse) => void
  ): ClientUnaryCall;
  findOne(
    request: FindOneRequest,
    metadata: Metadata,
    options: Partial<CallOptions>,
    callback: (error: ServiceError | null, response: QueryResponse) => void
  ): ClientUnaryCall;
  findMany(
    request: FindRequest,
    callback: (error: ServiceError | null, response: QueryResponse) => void
  ): ClientUnaryCall;
  findMany(
    request: FindRequest,
    metadata: Metadata,
    callback: (error: ServiceError | null, response: QueryResponse) => void
  ): ClientUnaryCall;
  findMany(
    request: FindRequest,
    metadata: Metadata,
    options: Partial<CallOptions>,
    callback: (error: ServiceError | null, response: QueryResponse) => void
  ): ClientUnaryCall;
  create(
    request: QueryRequest,
    callback: (error: ServiceError | null, response: QueryResponse) => void
  ): ClientUnaryCall;
  create(
    request: QueryRequest,
    metadata: Metadata,
    callback: (error: ServiceError | null, response: QueryResponse) => void
  ): ClientUnaryCall;
  create(
    request: QueryRequest,
    metadata: Metadata,
    options: Partial<CallOptions>,
    callback: (error: ServiceError | null, response: QueryResponse) => void
  ): ClientUnaryCall;
  createMany(
    request: QueryRequest,
    callback: (error: ServiceError | null, response: QueryResponse) => void
  ): ClientUnaryCall;
  createMany(
    request: QueryRequest,
    metadata: Metadata,
    callback: (error: ServiceError | null, response: QueryResponse) => void
  ): ClientUnaryCall;
  createMany(
    request: QueryRequest,
    metadata: Metadata,
    options: Partial<CallOptions>,
    callback: (error: ServiceError | null, response: QueryResponse) => void
  ): ClientUnaryCall;
  deleteOne(
    request: QueryRequest,
    callback: (error: ServiceError | null, response: QueryResponse) => void
  ): ClientUnaryCall;
  deleteOne(
    request: QueryRequest,
    metadata: Metadata,
    callback: (error: ServiceError | null, response: QueryResponse) => void
  ): ClientUnaryCall;
  deleteOne(
    request: QueryRequest,
    metadata: Metadata,
    options: Partial<CallOptions>,
    callback: (error: ServiceError | null, response: QueryResponse) => void
  ): ClientUnaryCall;
  deleteMany(
    request: QueryRequest,
    callback: (error: ServiceError | null, response: QueryResponse) => void
  ): ClientUnaryCall;
  deleteMany(
    request: QueryRequest,
    metadata: Metadata,
    callback: (error: ServiceError | null, response: QueryResponse) => void
  ): ClientUnaryCall;
  deleteMany(
    request: QueryRequest,
    metadata: Metadata,
    options: Partial<CallOptions>,
    callback: (error: ServiceError | null, response: QueryResponse) => void
  ): ClientUnaryCall;
  findByIdAndUpdate(
    request: UpdateRequest,
    callback: (error: ServiceError | null, response: QueryResponse) => void
  ): ClientUnaryCall;
  findByIdAndUpdate(
    request: UpdateRequest,
    metadata: Metadata,
    callback: (error: ServiceError | null, response: QueryResponse) => void
  ): ClientUnaryCall;
  findByIdAndUpdate(
    request: UpdateRequest,
    metadata: Metadata,
    options: Partial<CallOptions>,
    callback: (error: ServiceError | null, response: QueryResponse) => void
  ): ClientUnaryCall;
  updateMany(
    request: UpdateManyRequest,
    callback: (error: ServiceError | null, response: QueryResponse) => void
  ): ClientUnaryCall;
  updateMany(
    request: UpdateManyRequest,
    metadata: Metadata,
    callback: (error: ServiceError | null, response: QueryResponse) => void
  ): ClientUnaryCall;
  updateMany(
    request: UpdateManyRequest,
    metadata: Metadata,
    options: Partial<CallOptions>,
    callback: (error: ServiceError | null, response: QueryResponse) => void
  ): ClientUnaryCall;
  countDocuments(
    request: QueryRequest,
    callback: (error: ServiceError | null, response: QueryResponse) => void
  ): ClientUnaryCall;
  countDocuments(
    request: QueryRequest,
    metadata: Metadata,
    callback: (error: ServiceError | null, response: QueryResponse) => void
  ): ClientUnaryCall;
  countDocuments(
    request: QueryRequest,
    metadata: Metadata,
    options: Partial<CallOptions>,
    callback: (error: ServiceError | null, response: QueryResponse) => void
  ): ClientUnaryCall;
}

export const DatabaseProviderClient = makeGenericClientConstructor(
  DatabaseProviderService,
  'databaseprovider.DatabaseProvider'
) as unknown as {
  new (
    address: string,
    credentials: ChannelCredentials,
    options?: Partial<ChannelOptions>
  ): DatabaseProviderClient;
};

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;
export type DeepPartial<T> = T extends Builtin
  ? T
  : T extends Array<infer U>
  ? Array<DeepPartial<U>>
  : T extends ReadonlyArray<infer U>
  ? ReadonlyArray<DeepPartial<U>>
  : T extends {}
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;

if (_m0.util.Long !== Long) {
  _m0.util.Long = Long as any;
  _m0.configure();
}
