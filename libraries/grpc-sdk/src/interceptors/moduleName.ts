import { CallOptions, ClientMiddlewareCall, Metadata } from 'nice-grpc';

// export function getModuleNameInterceptor(moduleName: string) {
//   return (options: any, nextCall: Function) => {
//     return new InterceptingCall(nextCall(options), {
//       start: (metadata, _, next) => {
//         // outbound
//         metadata.set('module-name', moduleName);
//         const newListener = {
//           // inbound
//           onReceiveMetadata: function(metadata: Metadata, next: Function) {
//             metadata.set('module-name', moduleName);
//             next(metadata);
//           },
//         };
//         next(metadata, newListener);
//       },
//     });
//   };
// }


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

