import ConduitGrpcSdk from "@quintessential-sft/conduit-grpc-sdk";
import { constructQuery, getOpName } from "./utils";
import grpc from "grpc";
import { CustomEndpoint } from "../../models/customEndpoint";

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
    let params = JSON.parse(call.request.params).params;
    let searchString = "";

    endpoint.queries.forEach(
      (r: { schemaField: string; operation: number; comparisonField: { type: string; value: any } }) => {
        if (searchString.length !== 0) searchString += ",";
        if (r.comparisonField.type === "Input") {
          searchString += constructQuery(r.schemaField, r.operation, JSON.stringify(params[r.comparisonField.value]));
        } else {
          searchString += constructQuery(r.schemaField, r.operation, r.comparisonField.value);
        }
      }
    );

    searchString = "{" + searchString + "}";
    let promise;

    if (endpoint.operation === 0) {
      promise = this.grpcSdk.databaseProvider!.findMany(endpoint.selectedSchemaName, JSON.parse(searchString));
    } else if (endpoint.operation === 3) {
      promise = this.grpcSdk.databaseProvider!.deleteMany(endpoint.selectedSchemaName, JSON.parse(searchString));
    } else {
      // todo for now
      promise = this.grpcSdk.databaseProvider!.findMany(endpoint.selectedSchema, JSON.parse(searchString));
    }

    promise
      .then((r) => {
        callback(null, { result: JSON.stringify({ result: r }) });
      })
      .catch((err) => {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      });
  }
}
