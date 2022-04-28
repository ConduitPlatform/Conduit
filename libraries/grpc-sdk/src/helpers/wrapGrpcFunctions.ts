import { createVerifier } from 'fast-jwt';
import { status } from '@grpc/grpc-js';

interface JWT {
  moduleName: string;
  iat: number;
}

export function wrapGrpcFunctions(functions: { [name: string]: Function }, grpcKey: string) {
  const verify = createVerifier({ key: grpcKey });
  const wrappedFunctions: { [name: string]: Function } = {};
  Object.keys(functions).forEach((name) => {
    wrappedFunctions[name] = (call: any, callback: any) => {
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
      functions[name](call, callback);
    }
  });
  return wrappedFunctions;
}
