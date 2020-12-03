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
    let params = JSON.parse(call.request.params);
    let searchString = "";
    let createString = "";

    if ('params' in params) {
      params = params.params;
    }

    // if operation is not POST (CREATE)
    if (endpoint.operation !== 1) {
      endpoint.queries!.forEach(
        (r: { schemaField: string; operation: number; comparisonField: { type: string; value: any } }) => {
          if (searchString.length !== 0) searchString += ",";
          if (r.comparisonField.type === "Input") {
            searchString += constructQuery(r.schemaField, r.operation, JSON.stringify(params[r.comparisonField.value]));
          } else {
            searchString += constructQuery(r.schemaField, r.operation, r.comparisonField.value);
          }
        }
      );
    }

    if (endpoint.operation === 1 || endpoint.operation === 2) {
      endpoint.assignments!.forEach(
        (r: {schemaField: String, assignmentField: {type: String, value: any}}) => {
          if (createString.length !== 0) createString += ",";
          if (r.assignmentField.type === "Input") {
            createString += `\"${r.schemaField}: ${JSON.stringify(params[r.assignmentField.value])}\"`
          } else {
            createString += `\"${r.schemaField}: ${r.assignmentField.value}\"`
          }
        }
      )
    }

    searchString = "{" + searchString + "}";
    let promise;

    if (endpoint.operation === 0) {
      promise = this.grpcSdk.databaseProvider!.findMany(endpoint.selectedSchemaName, JSON.parse(searchString));
    } else if (endpoint.operation === 1) {
      console.log('eeeeeeeeee')
      console.log(params);
      console.log(createString);
      console.log('eeeeeeeeee')
      promise = this.grpcSdk.databaseProvider!.create(endpoint.selectedSchemaName, JSON.parse(createString));
    } else if (endpoint.operation === 2) {
      promise = this.grpcSdk.databaseProvider!.updateMany(endpoint.selectedSchemaName, JSON.parse(searchString), JSON.parse(createString));
    } else if (endpoint.operation === 3) {
      promise = this.grpcSdk.databaseProvider!.deleteMany(endpoint.selectedSchemaName, JSON.parse(searchString));
    } else {
      // todo for now
      promise = this.grpcSdk.databaseProvider!.findMany(endpoint.selectedSchema, JSON.parse(searchString));
    }

    promise
      .then((r: any) => {
        if (endpoint.operation === 1) r = [r];
        callback(null, { result: JSON.stringify({ result: r }) });
      })
      .catch((err: any) => {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      });
  }
}
