import { GrpcRequest, GrpcResponse } from '@conduitplatform/grpc-sdk';

export type ServiceFunction = (
  call: GrpcRequest<any>,
  callback: GrpcResponse<any>,
) => void | Promise<void>;

export interface ConduitService {
  readonly protoPath: string;
  readonly protoDescription: string;
  functions: {
    [p: string]: ServiceFunction | { [p: string]: ServiceFunction };
  };
}
