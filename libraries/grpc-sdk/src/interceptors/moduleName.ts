import { Metadata, InterceptingCall } from '@grpc/grpc-js';

export function getModuleNameInterceptor(moduleName: string) {
  return (options: any, nextCall: Function) => {
    return new InterceptingCall(nextCall(options), {
      start: (metadata, _, next) => {
        // outbound
        metadata.set('module-name', moduleName);
        const newListener = {
          // inbound
          onReceiveMetadata: function (metadata: Metadata, next: Function) {
            metadata.set('module-name', moduleName);
            next(metadata);
          },
        };
        next(metadata, newListener);
      },
    });
  };
}
