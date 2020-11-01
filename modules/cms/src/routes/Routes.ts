import { CmsHandlers } from "../handlers/cms.handler";
import grpc from "grpc";
import fs from "fs";
import path from "path";
import { CustomEndpointHandler } from "../handlers/CustomEndpoints/customEndpoint.handler";
import ConduitGrpcSdk from "@quintessential-sft/conduit-grpc-sdk";

var protoLoader = require("@grpc/proto-loader");
var PROTO_PATH = __dirname + "/router.proto";

export class CmsRoutes {
  private readonly handlers: CmsHandlers;
  private readonly customEndpointHandler: CustomEndpointHandler;
  //todo change this since now routes are getting appended
  //while the conduit router handles duplicates we should clean them up on this end as well
  private _registeredRoutes: any[] = [];

  constructor(server: grpc.Server, private readonly grpcSdk: ConduitGrpcSdk, private readonly url: string) {
    this.handlers = new CmsHandlers(grpcSdk);
    this.customEndpointHandler = new CustomEndpointHandler(grpcSdk);

    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    // @ts-ignore
    const router = protoDescriptor.cms.router.Router;
    server.addService(router.service, {
      getDocuments: this.handlers.getDocuments.bind(this.handlers),
      getDocumentById: this.handlers.getDocumentById.bind(this.handlers),
      createDocument: this.handlers.createDocument.bind(this.handlers),
      editDocument: this.handlers.editDocument.bind(this.handlers),
      deleteDocument: this.handlers.deleteDocument.bind(this.handlers),
      customOperation: this.customEndpointHandler.entryPoint.bind(this.customEndpointHandler),
    });
  }

  addRoutes(routes: any[]){
    this._registeredRoutes.push(...routes);
  }

  requestRefresh(){
    this._refreshRoutes();
  }

  private _refreshRoutes() {
    let routesProtoFile = fs.readFileSync(path.resolve(__dirname, "./router.proto"));
    this.grpcSdk.router.register(this._registeredRoutes, routesProtoFile.toString("utf-8"), this.url).catch((err: Error) => {
      console.log("Failed to register routes for CMS module!");
      console.error(err);
    });
  }
}
