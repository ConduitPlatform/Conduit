import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import grpc from 'grpc';
import { Stuff } from './stuff';

var protoLoader = require('@grpc/proto-loader');
var PROTO_PATH = __dirname + '/admin.proto';

export class AdminHandlers {
  private database: any;

  constructor(server: grpc.Server, private readonly grpcSdk: ConduitGrpcSdk) {
    const self = this;
    grpcSdk.waitForExistence('database-provider').then(() => {
      self.database = self.grpcSdk.databaseProvider;
    });
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    // @ts-ignore
    const router = protoDescriptor.my_custom_service.admin.Admin;
    let stuffController = new Stuff(grpcSdk);

    server.addService(router.service, {
      getStuff: stuffController.getStuff.bind(stuffController),
      updateStuff: stuffController.updateStuff.bind(stuffController),
      updatePartOfStuff: stuffController.updatePartOfStuff.bind(stuffController),
      deleteStuff: stuffController.deleteStuff.bind(stuffController),
      createStuff: stuffController.createStuff.bind(stuffController),
    });
  }
}
