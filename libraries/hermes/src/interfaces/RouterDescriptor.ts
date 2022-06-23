import {
  GrpcObject,
  ProtobufTypeDefinition,
  ServiceClientConstructor,
} from '@grpc/grpc-js';

export type RouterDescriptor =
  | GrpcObject
  | ServiceClientConstructor
  | ProtobufTypeDefinition;
