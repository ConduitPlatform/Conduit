import ConduitGrpcSdk, {
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  constructRoute,
  TYPE
} from '@conduit/grpc-sdk';
import { CmsHandlers } from '../handlers/CmsHandlers';
import grpc from 'grpc';

var protoLoader = require('@grpc/proto-loader');
var PROTO_PATH = __dirname + '/router.proto';

export class CmsRoutes {
  private readonly handlers: CmsHandlers;

  constructor(server: grpc.Server, private readonly grpcSdk: ConduitGrpcSdk) {
    this.handlers = new CmsHandlers(grpcSdk);

    const packageDefinition = protoLoader.loadSync(
      PROTO_PATH,
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
      });
    const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    // @ts-ignore
    const router = protoDescriptor.cms.router.Router;
    server.addService(router.service, {
      getDocuments: this.handlers.getDocuments.bind(this.handlers),
      getDocumentById: this.handlers.getDocumentById.bind(this.handlers),
      createDocument: this.handlers.createDocument.bind(this.handlers),
      editDocument: this.handlers.editDocument.bind(this.handlers),
      deleteDocument: this.handlers.deleteDocument.bind(this.handlers)
    });
  }

  get registeredRoutes(): any[] {
    let routesArray: any = [];

    routesArray.push(constructRoute(new ConduitRoute({
        path: '/content/:schemaName',
        action: ConduitRouteActions.GET,
        queryParams: {
          skip: TYPE.Number,
          limit: TYPE.Number
        },
        urlParams: {
          schemaName: TYPE.String
        }
      }, new ConduitRouteReturnDefinition('documents', {result: {documents: [TYPE.JSON], documentsCount: TYPE.Number}}),
      'getDocuments'
    )));

    routesArray.push(constructRoute(new ConduitRoute({
      path: '/content/:schemaName/:id',
      action: ConduitRouteActions.GET,
      urlParams: {
        schemaName: TYPE.String,
        id: TYPE.String
      }
      }, new ConduitRouteReturnDefinition('document', {document: TYPE.JSON}),
      'getDocumentById')));

    routesArray.push(constructRoute(new ConduitRoute({
      path: '/content/:schemaName',
      action: ConduitRouteActions.POST,
      bodyParams: {
        inputDocument: TYPE.JSON
      }
      }, new ConduitRouteReturnDefinition('document', {document: TYPE.JSON}),
      'createDocument')));

    routesArray.push(constructRoute(new ConduitRoute({
      path: '/content/:schemaName/:id',
      action: ConduitRouteActions.UPDATE,
      urlParams: {
        schemaName: TYPE.String,
        id: TYPE.String,
      },
      bodyParams: {
        changedDocument: TYPE.JSON
      }
      }, new ConduitRouteReturnDefinition('document', {document: TYPE.JSON}),
      'editDocument')));

    routesArray.push(constructRoute(new ConduitRoute({
      path: '/content/:schemaName/:id',
      action: ConduitRouteActions.DELETE,
      urlParams: {
        schemaName: TYPE.String,
        id: TYPE.String
      }
      }, new ConduitRouteReturnDefinition('result', {result: TYPE.String}),
      'deleteDocument')));

    return routesArray;
  }
}
