import { GrpcRequest, GrpcResponse } from '@conduitplatform/grpc-sdk';

export type GetServerConfigResponse = GrpcResponse<{
  data: string;
}>

export type GetRedisDetailsResponse = GrpcResponse<{
  redisHost?: string;
  redisPort?: string;
}>

export type ConfigRequest = GrpcRequest<{
  moduleName: string;
  config: string;
}>

export type ModuleListResponse = GrpcResponse<{
  modules: {
    moduleName: string;
    url: string;
    serving: boolean
  }[]
}>
