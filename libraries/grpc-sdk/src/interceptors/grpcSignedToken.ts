import { CallOptions, ClientMiddlewareCall, Metadata } from 'nice-grpc';

export function getGrpcSignedTokenInterceptor(grpcToken: string) {
  return async function* middleware<Request, Response>(
    call: ClientMiddlewareCall<Request, Response>,
    options: CallOptions,
  ) {
    if (!options.metadata) {
      options.metadata = Metadata();
    }
    options.metadata?.set('grpc-token', grpcToken);
    return yield* call.next(call.request, options);
  };
}
