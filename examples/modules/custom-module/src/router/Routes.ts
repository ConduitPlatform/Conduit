import grpc from 'grpc';
import fs from 'fs';
import path from 'path';
import ConduitGrpcSdk, {
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  constructRoute,
  TYPE,
} from '@quintessential-sft/conduit-grpc-sdk';
import { AdminHandlers } from '../admin';
import { Stuff } from '../handlers/stuff';

let adminPaths = require('../admin/admin.json').functions;
var protoLoader = require('@grpc/proto-loader');
var PROTO_PATH = __dirname + '/router.proto';

export class AgoraRouter {
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    // @ts-ignore
    const router = protoDescriptor.my_custom_service.router.Router;
    let grpcServer = new grpc.Server();

    this._url = process.env.SERVICE_URL || '0.0.0.0:0';
    //@ts-ignore
    let result = grpcServer.bind(this._url, grpc.ServerCredentials.createInsecure(), {
      'grpc.max_receive_message_length': 1024 * 1024 * 100,
      'grpc.max_send_message_length': 1024 * 1024 * 100,
    });
    this._url = process.env.SERVICE_URL || '0.0.0.0:' + result;

    let suppliers = new Stuff(grpcSdk);

    grpcServer.addService(router.service, {
      reviewOrder: suppliers.reviewOrder.bind(suppliers),
      myOrdersSupplier: suppliers.myOrdersSupplier.bind(suppliers),
      getSupplierCustomers: suppliers.getSupplierCustomers.bind(suppliers),
      deleteSupplierCustomer: suppliers.deleteSupplierCustomer.bind(suppliers),
      getSupplierCustomersExport: suppliers.getSupplierCustomersXLSX.bind(suppliers),
    });

    new AdminHandlers(grpcServer, grpcSdk);
    grpcServer.start();
    console.log('Listenining on :' + this._url);
    this.registerRoutes();
  }

  private _url: string;

  get url() {
    return this._url;
  }

  private registerRoutes() {
    let routesArray: any[] = [];

    routesArray.push(
      constructRoute(
        new ConduitRoute(
          {
            bodyParams: {
              deliveryAddress: {
                fullName: { type: TYPE.String, required: true },
                address: { type: TYPE.String, required: true },
                area: { type: TYPE.String, required: true },
                postCode: { type: TYPE.Number, required: true },
                phone: { type: TYPE.String, required: true },
              },
              store: { type: TYPE.String, required: true },
              supplier: { type: TYPE.String, required: true },
              deliveryDate: { type: TYPE.Date, required: true },
              comments: { type: TYPE.String, required: true },
            },
            action: ConduitRouteActions.POST,
            path: '/services/submitOrder',
            middlewares: ['authMiddleware'],
          },
          new ConduitRouteReturnDefinition('SubmitOrderResponse', {
            orderNumber: TYPE.String,
          }),
          'submitOrder'
        )
      )
    );

    let url = this._url;
    if (process.env.REGISTER_NAME === 'true') {
      url = 'my-custom-service:' + this._url.split(':')[1];
    }
    let routesProtoFile = fs.readFileSync(path.resolve(__dirname, './router.proto'));
    this.grpcSdk.router
      .register(routesArray, routesProtoFile.toString('utf-8'), url)
      .catch((err: Error) => {
        console.log('Failed to register routes for Extender module!');
        console.error(err);
      })
      .then(() => {
        let adminProtoFile = fs.readFileSync(
          path.resolve(__dirname, '../admin/admin.proto')
        );
        return this.grpcSdk.admin.register(
          adminPaths,
          adminProtoFile.toString('utf-8'),
          url
        );
      })
      .catch((err: Error) => {
        console.log('Failed to register admin routes for Extender module!');
        console.error(err);
      });
  }
}
