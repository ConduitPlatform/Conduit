import { GrpcError, ModuleErrorDefinition } from '@conduitplatform/grpc-sdk';

export class ModuleError extends GrpcError {
  debugLogInfo?: string;

  constructor(errorDefinition: ModuleErrorDefinition, debugLogInfo?: string) {
    const { grpcCode, conduitCode, message } = errorDefinition;
    super(
      grpcCode,
      JSON.stringify({
        message,
        conduitCode: conduitCode,
      }),
    );
    if (debugLogInfo) this.debugLogInfo = debugLogInfo;
  }
}
