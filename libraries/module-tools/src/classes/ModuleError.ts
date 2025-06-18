import { GrpcError } from '@conduitplatform/grpc-sdk';

export class ModuleError extends GrpcError {
  debugLogInfo?: string;

  constructor(
    errorDefinition: {
      grpcCode: number;
      conduitCode: string;
      message: string;
      description: string;
    },
    debugLogInfo?: string,
  ) {
    const { grpcCode, conduitCode, message } = errorDefinition;
    super(
      grpcCode,
      JSON.stringify({
        message,
        conduitCode: conduitCode,
      }),
    );
    this.debugLogInfo = debugLogInfo;
  }
}
