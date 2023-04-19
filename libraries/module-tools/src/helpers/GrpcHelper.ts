import {
  loadPackageDefinition,
  Server,
  ServerCredentials,
  UntypedServiceImplementation,
} from '@grpc/grpc-js';

const protoLoader = require('@grpc/proto-loader');

export function createServer(port: string): Promise<{ server: Server; port: number }> {
  const grpcServer: Server = new Server({
    'grpc.max_receive_message_length': 1024 * 1024 * 100,
    'grpc.max_send_message_length': 1024 * 1024 * 100,
  });
  return new Promise((resolve, reject) => {
    grpcServer.bindAsync(port, ServerCredentials.createInsecure(), (err, port) => {
      if (err) {
        reject(err);
      } else {
        resolve({
          server: grpcServer,
          port,
        });
      }
    });
  });
}

export function addServiceToServer(
  server: Server,
  protoPath: string,
  descriptorObject: string,
  functions: { [name: string]: Function },
) {
  const packageDefinition = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const protoDescriptor = loadPackageDefinition(packageDefinition);
  const objs = descriptorObject.split('.');
  let descObj: any = protoDescriptor;
  objs.forEach((r: string) => {
    descObj = descObj[r] as any;
  });

  server.addService(descObj.service, functions as UntypedServiceImplementation);
}
