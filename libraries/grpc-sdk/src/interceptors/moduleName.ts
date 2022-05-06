import { CallOptions, ClientMiddlewareCall, Metadata } from 'nice-grpc';

export function getModuleNameInterceptor(moduleName: string) {
  return async function* middleware<Request, Response>(
    call: ClientMiddlewareCall<Request, Response>,
    options: CallOptions,
  ) {
    if (!options.metadata) {
      options.metadata = Metadata();
    }
    options.metadata?.set('module-name', moduleName);
    return yield* call.next(call.request, options);
  };
}
