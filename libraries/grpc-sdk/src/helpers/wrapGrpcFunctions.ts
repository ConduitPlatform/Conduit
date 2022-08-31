import { createVerifier } from 'fast-jwt';
import { status } from '@grpc/grpc-js';
import ConduitGrpcSdk, { GrpcError } from '../index';

interface JWT {
  moduleName: string;
  iat: number;
}

export function wrapGrpcFunctions(functions: { [name: string]: Function }) {
  const grpcKey = process.env.GRPC_KEY;
  const wrappedFunctions: { [name: string]: Function } = {};
  Object.keys(functions).forEach(name => {
    wrappedFunctions[name] = (call: any, callback: any) => {
      if (grpcKey) {
        const verify = createVerifier({ key: grpcKey });
        const grpcToken = call.metadata.get('grpc-token')[0];
        if (!grpcToken) {
          callback({
            code: status.PERMISSION_DENIED,
            message: 'No gRPC protection token provided',
          });
          return;
        }
        try {
          const jwt: JWT = verify(grpcToken);
          call.metadata.set('module-name', jwt.moduleName);
        } catch {
          callback({
            code: status.PERMISSION_DENIED,
            message: 'Failed to verify gRPC protection token. GRPC_KEY value differs',
          });
          return;
        }
      }
      ConduitGrpcSdk.Metrics?.increment('internal_grpc_requests_total');
      try {
        functions[name](call, callback);
      } catch (error) {
        ConduitGrpcSdk.Metrics?.increment('internal_grpc_requests_errors');
        callback({
          code: status.INTERNAL,
          message: (error as Error).message,
        });
      }
    };
  });
  return wrappedFunctions;
}
