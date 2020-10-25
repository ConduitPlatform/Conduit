import ConduitGrpcSdk from "@quintessential-sft/conduit-grpc-sdk";
import { CustomEndpoint } from "../../models/CustomEndpoint";
import { constructQuery, getOpName } from "./utils";
import grpc from "grpc";

export class CustomEndpointHandler {
  private static routeControllers: { [name: string]: any } = {};

  static addNewCustomOperationControl(endpoint: CustomEndpoint) {
    CustomEndpointHandler.routeControllers[endpoint.name] = endpoint;
  }

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  entryPoint(call: any, callback: any) {
    //use it to find the right controller
    let path = call.request.path.split("/")[2];
    let endpoint: CustomEndpoint = CustomEndpointHandler.routeControllers[path];

    this.grpcSdk
      .databaseProvider!.findOne("SchemaDefinitions", { _id: endpoint.selectedSchema })
      .then((r) => {
        let params = JSON.parse(call.request.params).params
        let searchString = "";
        endpoint.queries.forEach(
          (r: { schemaField: string; operation: number; comparisonField: { type: string; value: any } }) => {
            if (searchString.length !== 0) searchString += ",";
            if (r.comparisonField.type === "Input") {
              searchString += constructQuery(r.schemaField, r.operation,JSON.stringify(params[r.comparisonField.value]));
            } else {
              searchString += constructQuery(r.schemaField, r.operation, r.comparisonField.value);
            }
          }
        );
        searchString = "{" + searchString + "}";
        return this.grpcSdk.databaseProvider!.findMany(r.name, JSON.parse(searchString));
      })
      .then((r) => {
        callback(null, { result: JSON.stringify({result:r}) });
      })
      .catch((err) => {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      });
  }
}
