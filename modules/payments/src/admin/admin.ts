import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import grpc from "grpc";
import path from "path";
import {isNil} from 'lodash';

const protoLoader = require('@grpc/proto-loader');

export class AdminHandlers {
  private database: any;

  constructor(server: grpc.Server, private readonly grpcSdk: ConduitGrpcSdk) {
    const self = this;
    grpcSdk.waitForExistence('database-provider')
      .then(r => {
        self.database = self.grpcSdk.databaseProvider;
      });

    let packageDefinition = protoLoader.loadSync(
      path.resolve(__dirname, './admin.proto'),
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
      }
    );

    let protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    // @ts-ignore
    let admin = protoDescriptor.payments.admin.Admin;
    server.addService(admin.service, {
      createProduct: this.createProduct.bind(this),
    });
  }

  async createProduct(call: any, callback: any) {
    const { name, value, currency, isSubscription, renewEvery } = JSON.parse(call.request.params);

    if (isNil(name) || isNil(value) || isNil(currency)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: "product name, value and currency are required"
      });
    }

    if (isSubscription && isNil(renewEvery)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: "renewEvery is required for subscription products"
      });
    }

    let errorMessage: string | null = null;

    const product = await this.database.create('Product', {
      name,
      value,
      currency,
      isSubscription,
      renewEvery
    }).catch((e: Error) => {
      errorMessage = e.message;
    });

    if (!isNil(errorMessage)) {
      return callback({
        code: grpc.status.INTERNAL,
        message: errorMessage
      });
    }

    return callback(null, { result: JSON.stringify({ product }) });
  }
}