import { createVerifier } from 'fast-jwt';
import { status } from '@grpc/grpc-js';
import ConduitGrpcSdk, { GrpcCallback } from '../index';

interface JWT {
  moduleName: string;
  iat: number;
}

export function wrapGrpcFunctions(
  functions: { [name: string]: Function },
  postponeRestart: () => void,
) {
  const grpcKey = process.env.GRPC_KEY;
  const wrappedFunctions: { [name: string]: Function } = {};
  Object.keys(functions).forEach(name => {
    wrappedFunctions[name] = (call: any, callback: any) => {
      postponeRestart();
      if (grpcKey) {
        const verify = createVerifier({ key: grpcKey });
        const grpcToken = call.metadata.get('grpc-token')[0];
        if (!grpcToken) {
          return throwError(
            callback,
            'No gRPC protection token provided',
            status.PERMISSION_DENIED,
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
          );
        }
      }
      ConduitGrpcSdk.Metrics?.increment('internal_grpc_requests_total');
      let invoked: any | Promise<any>;
      try {
        invoked = functions[name](call, callback);
      } catch (error) {
        return throwError(callback, (error as Error).message);
      }
      if (typeof invoked?.then === 'function') {
        invoked.then().catch((error: Error) => {
          return throwError(callback, error.message);
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
) {
  // Aborting server streams is not yet implemented!
  if (callback) {
    callback({ code, message });
  }
}
