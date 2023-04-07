import { GrpcRequest, GrpcResponse } from '@conduitplatform/grpc-sdk';

export interface ConduitService {
  readonly protoPath: string;
  readonly protoDescription: string;
  functions: {
    [p: string]: (
      call: GrpcRequest<any>,
      callback: GrpcResponse<any>,
    ) => void | Promise<void>;
  };
}
