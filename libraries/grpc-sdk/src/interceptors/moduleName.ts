import { Metadata, InterceptingCall } from '@grpc/grpc-js';

// https://grpc.github.io/grpc/node/grpc.Client.html
// https://programmer.help/blogs/5ded9da2c7e91.html
// https://grpc.github.io/grpc/node/grpc.Metadata.html
// https://github.com/grpc/proposal/blob/master/L5-node-client-interceptors.md

export function getModuleNameInterceptor(moduleName: string) {
  return (options: any, nextCall: Function) => {
    return new InterceptingCall(nextCall(options), {
      start(metadata, _, next) {
        next(metadata, {
          onReceiveMetadata(metadata: Metadata, next: Function) {
            // metadata.set('moduleName', moduleName);
            metadata.add('moduleName', moduleName);
            next(metadata);
          }
        });
      },
    });
  };
}
