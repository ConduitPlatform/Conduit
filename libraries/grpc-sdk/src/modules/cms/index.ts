import * as grpc from 'grpc';
import path from 'path';

let protoLoader = require('@grpc/proto-loader');

export default class CMS {
  private readonly client: any;

  constructor(url: string) {
    var packageDefinition = protoLoader.loadSync(
      path.resolve(__dirname, '../../proto/cms.proto'),
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
      });
    var protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    // @ts-ignore
    var authentication = protoDescriptor.cms.CMS;
    this.client = new authentication(url, grpc.credentials.createInsecure());
  }
}
