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

export class ExampleRouter {
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

    let stuffController = new Stuff(grpcSdk);

    grpcServer.addService(router.service, {
      getStuff: stuffController.getStuff.bind(stuffController),
      updateStuff: stuffController.updateStuff.bind(stuffController),
      updatePartOfStuff: stuffController.updatePartOfStuff.bind(stuffController),
      deleteStuff: stuffController.deleteStuff.bind(stuffController),
      createStuff: stuffController.createStuff.bind(stuffController),
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
            queryParams: {
              skip: {
                type: TYPE.Number,
                required: true,
              },
              limit: {
                type: TYPE.Number,
                required: true,
              },
              sort: {
                type: [TYPE.String],
                required: false,
              },
            },
            action: ConduitRouteActions.GET,
            path: '/services/stuff',
            middlewares: ['authMiddleware'],
          },
          new ConduitRouteReturnDefinition('GetStuffResponse', {
            documents: ['Stuff'],
            documentsCount: TYPE.Number,
          }),
          'getStuff'
        )
      )
    );

    routesArray.push(
      constructRoute(
        new ConduitRoute(
          {
            bodyParams: {
              // add here all the params included in the schema
              // Since this is a UPDATE(PUT) endpoint,
              // the client needs to provide all fields
            },
            urlParams: {
              id: { type: TYPE.String, required: true },
            },
            action: ConduitRouteActions.UPDATE,
            path: '/services/stuff/:id',
            middlewares: ['authMiddleware'],
          },
          new ConduitRouteReturnDefinition('UpdateStuffResponse', {
            // add here all the fields included in the schema
          }),
          'updateStuff'
        )
      )
    );

    routesArray.push(
      constructRoute(
        new ConduitRoute(
          {
            bodyParams: {
              // add here all the params included in the schema
              // Since this is a PATCH endpoint,
              // the client does not need to provide all fields
            },
            urlParams: {
              id: { type: TYPE.String, required: true },
            },
            action: ConduitRouteActions.PATCH,
            path: '/services/stuff/:id',
            middlewares: ['authMiddleware'],
          },
          new ConduitRouteReturnDefinition('UpdatePartOfStuffResponse', {
            // add here all the fields included in the schema
          }),
          'updatePartOfStuff'
        )
      )
    );

    routesArray.push(
      constructRoute(
        new ConduitRoute(
          {
            urlParams: {
              id: { type: TYPE.String, required: true },
            },
            action: ConduitRouteActions.DELETE,
            path: '/services/stuff/:id',
            middlewares: ['authMiddleware'],
          },
          new ConduitRouteReturnDefinition('Stuff', 'String'),
          'deleteStuff'
        )
      )
    );
    routesArray.push(
      constructRoute(
        new ConduitRoute(
          {
            bodyParams: {
              // add here all the params required by the schema
            },
            action: ConduitRouteActions.POST,
            path: '/services/stuff',
            middlewares: ['authMiddleware'],
          },
          new ConduitRouteReturnDefinition('Stuff', {
            // add here all the fields included in the schema
          }),
          'createStuff'
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
