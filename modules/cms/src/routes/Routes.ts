import { CmsHandlers } from '../handlers/cms.handler';
import { CustomEndpointHandler } from '../handlers/CustomEndpoints/customEndpoint.handler';
import ConduitGrpcSdk, { GrpcServer } from '@quintessential-sft/conduit-grpc-sdk';

export class CmsRoutes {
  private readonly handlers: CmsHandlers;
  private readonly customEndpointHandler: CustomEndpointHandler;
  //todo change this since now routes are getting appended
  //while the conduit router handles duplicates we should clean them up on this end as well
  private crudRoutes: any[] = [];
  private customRoutes: any[] = [];

  constructor(readonly server: GrpcServer, private readonly grpcSdk: ConduitGrpcSdk) {
    this.handlers = new CmsHandlers(grpcSdk);
    this.customEndpointHandler = new CustomEndpointHandler(grpcSdk);
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
      .registerRouter(this.server, this.crudRoutes.concat(this.customRoutes), {
        getDocuments: this.handlers.getDocuments.bind(this.handlers),
        getDocumentById: this.handlers.getDocumentById.bind(this.handlers),
        createDocument: this.handlers.createDocument.bind(this.handlers),
        createManyDocuments: this.handlers.createManyDocuments.bind(this.handlers),
        editDocument: this.handlers.editDocument.bind(this.handlers),
        patchDocument: this.handlers.patchDocument.bind(this.handlers),
        editManyDocuments: this.handlers.editManyDocuments.bind(this.handlers),
        patchManyDocuments: this.handlers.patchManyDocuments.bind(this.handlers),
        deleteDocument: this.handlers.deleteDocument.bind(this.handlers),
        customOperation: this.customEndpointHandler.entryPoint.bind(
          this.customEndpointHandler
        ),
      })
      .catch((err: Error) => {
        console.log('Failed to register routes for module');
        console.log(err);
      });
  }
}
