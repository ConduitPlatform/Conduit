import {
  GrpcError,
  isGrpcStatusError,
  ModuleErrorDefinition,
} from '@conduitplatform/grpc-sdk';

/**
 * A typed error from a module's catalog (see `defineErrors`). Clients receive
 * `{ message, conduitCode }`; `debugLogInfo` is only written to the module's log, so
 * it is the place for the underlying cause (a driver or provider message).
 */
export class ModuleError extends GrpcError {
  readonly conduitCode: string;
  readonly definition: ModuleErrorDefinition;
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
    this.conduitCode = conduitCode;
    this.definition = errorDefinition;
    if (debugLogInfo) this.debugLogInfo = debugLogInfo;
  }

  /**
   * For `.catch(ModuleError.rethrow(errors.X))`: typed errors pass through untouched,
   * anything else becomes `definition` with the original message kept for the log.
   */
  static rethrow(definition: ModuleErrorDefinition): (cause: unknown) => never {
    return (cause: unknown) => {
      throw ModuleError.from(cause, definition);
    };
  }

  /**
   * `cause` itself when it already carries a gRPC status (a GrpcError thrown here or an
   * error returned by another module), otherwise `definition`.
   */
  static from(cause: unknown, definition: ModuleErrorDefinition): Error {
    if (isGrpcStatusError(cause)) return cause;
    const text = cause instanceof Error ? cause.message : String(cause ?? '');
    return new ModuleError(definition, text || undefined);
  }
}
