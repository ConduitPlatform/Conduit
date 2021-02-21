import { CmsHandlers } from '../handlers/cms.handler';
import { CustomEndpointHandler } from '../handlers/CustomEndpoints/customEndpoint.handler';
import ConduitGrpcSdk, { GrpcServer } from '@quintessential-sft/conduit-grpc-sdk';
import * as path from 'path';

export class CmsRoutes {
  private readonly handlers: CmsHandlers;
  private readonly customEndpointHandler: CustomEndpointHandler;
  //todo change this since now routes are getting appended
  //while the conduit router handles duplicates we should clean them up on this end as well
  private crudRoutes: any[] = [];
  private customRoutes: any[] = [];

  constructor(server: GrpcServer, private readonly grpcSdk: ConduitGrpcSdk) {
    this.handlers = new CmsHandlers(grpcSdk);
    this.customEndpointHandler = new CustomEndpointHandler(grpcSdk);

    server
      .addService(path.resolve(__dirname + '/router.proto'), 'cms.router.Router', {
        getDocuments: this.handlers.getDocuments.bind(this.handlers),
        getDocumentById: this.handlers.getDocumentById.bind(this.handlers),
        createDocument: this.handlers.createDocument.bind(this.handlers),
        createManyDocuments: this.handlers.createManyDocuments.bind(this.handlers),
        editDocument: this.handlers.editDocument.bind(this.handlers),
        editManyDocuments: this.handlers.editManyDocuments.bind(this.handlers),
        deleteDocument: this.handlers.deleteDocument.bind(this.handlers),
        customOperation: this.customEndpointHandler.entryPoint.bind(
          this.customEndpointHandler
        ),
      })
      .catch(() => {
        console.log('Failed to register routes');
      });
  }

  addRoutes(routes: any[], crud: boolean = true) {
    if (crud) {
      this.crudRoutes = routes;
    } else {
      this.customRoutes = routes;
    }
  }

  requestRefresh() {
    if (this.crudRoutes && this.crudRoutes.length !== 0) {
      this._refreshRoutes();
    }
  }

  private _refreshRoutes() {
    this.grpcSdk.router
      .register(this.crudRoutes.concat(this.customRoutes))
      .catch((err: Error) => {
        console.log('Failed to register routes for CMS module!');
        console.error(err);
      });
  }
}
