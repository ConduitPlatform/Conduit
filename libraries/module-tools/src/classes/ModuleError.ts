import { GrpcError } from '@conduitplatform/grpc-sdk';
import { ModuleErrorDefinition } from '../interfaces';

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
