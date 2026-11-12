import { createVerifier } from 'fast-jwt';
import { status } from '@grpc/grpc-js';
import { ConduitGrpcSdk, GrpcCallback } from '@conduitplatform/grpc-sdk';
import { hasDebugInfo, toGrpcStatus } from './toGrpcStatus.js';

interface JWT {
  moduleName: string;
  iat: number;
}

export function wrapGrpcFunctions(
  functions: { [name: string]: Function },
  postponeRestart: () => void,
  noAuth: boolean = false,
) {
  const grpcKey = process.env.GRPC_KEY;
  const wrappedFunctions: { [name: string]: Function } = {};
  Object.keys(functions).forEach(name => {
    wrappedFunctions[name] = (call: any, callback: any) => {
      ConduitGrpcSdk.Metrics?.increment('internal_grpc_requests_total');
      postponeRestart();
      if (grpcKey && !noAuth) {
        const verify = createVerifier({ key: grpcKey });
        const grpcToken = call.metadata.get('grpc-token')[0];
        if (!grpcToken) {
          return throwError(
            callback,
            'No gRPC protection token provided',
            status.PERMISSION_DENIED,
            call,
          );
        }
        try {
          const jwt: JWT = verify(grpcToken);
          call.metadata.set('module-name', jwt.moduleName);
        } catch {
          return throwError(
            callback,
            'Failed to verify gRPC protection token. GRPC_KEY value differs',
            status.PERMISSION_DENIED,
            call,
          );
        }
      }
      let invoked: any | Promise<any>;
      try {
        invoked = functions[name](call, callback);
      } catch (error) {
        const { code, message, log } = toGrpcStatus(error);
        if (hasDebugInfo(error)) ConduitGrpcSdk.Logger.error(log);
        return throwError(callback, message, code, call);
      }
      if (typeof invoked?.then === 'function') {
        invoked.then().catch((error: Error) => {
          const { code, message, log } = toGrpcStatus(error);
          if (hasDebugInfo(error)) ConduitGrpcSdk.Logger.error(log);
          return throwError(callback, message, code, call);
        });
      }
    };
  });
  return wrappedFunctions;
}

function throwError(
  callback: GrpcCallback<any> | undefined,
  message: string,
  code: status = status.INTERNAL,
  call?: { emit?: (event: 'error', error: object) => unknown },
) {
  if (callback) {
    callback({ code, message });
    return;
  }
  // Streaming handlers get no callback: the status travels as an error on the stream.
  call?.emit?.('error', { code, message, details: message });
}
