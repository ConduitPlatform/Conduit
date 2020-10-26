import ConduitGrpcSdk from "@quintessential-sft/conduit-grpc-sdk";
import { SchemaController } from "../../controllers/cms/schema.controller";
import { inputValidation, queryValidation } from "./utils";
import grpc from "grpc";
import { isNil } from "lodash";
import schema from "../../models/customEndpoint.schema";
import { CustomEndpointController } from "../../controllers/CustomEndpoints/customEndpoint.controller";

export class CustomEndpointsAdmin {
  private database: any;

  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly customEndpointController: CustomEndpointController
  ) {
    this.database = this.grpcSdk.databaseProvider;
    this.database
      .createSchemaFromAdapter(schema)
      .then((r: any) => {
        console.log("Registered custom endpoints schema");
      })
      .catch((err: any) => {
        console.log(err);
      });
  }

  async getCustomEndpoints(call: any, callback: any) {
    let errorMessage: string | null = null;

    const customEndpointsDocs = await this.database
      .findMany("CustomEndpoints", {})
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    return callback(null, { result: JSON.stringify({ results: customEndpointsDocs }) });
  }

  async editCustomEndpoints(call: any, callback: any) {
    const params = JSON.parse(call.request.params);
    const id = params.id;
    const { inputs, queries, selectedSchema } = params;
    if (isNil(id)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: "id must not be null",
      });
    }
    let errorMessage: string | null = null;
    delete params.id;
    const found = await this.database
      .findOne("CustomEndpoints", {
        _id: id,
      })
      .catch((e: any) => (errorMessage = e.message));
    if (isNil(found) || !isNil(errorMessage)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: "Schema not found",
      });
    }
    errorMessage = null;
    const findSchema = await this.database
      .findOne("SchemaDefinitions", {
        _id: selectedSchema,
      })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage) || isNil(findSchema)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: "SelectedSchema not found",
      });
    }

    // todo checks for inputs & queries
    if (!Array.isArray(inputs)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: "Inputs must be an array, even if empty!",
      });
    }
    if (!Array.isArray(queries) || queries.length === 0) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: "The queries field must be an array, and not empty!",
      });
    }

    errorMessage = null;
    inputs.forEach((r) => {
      let error = inputValidation(r.name, r.type, r.location);
      if (error !== true) {
        return (errorMessage = error as string);
      }
    });
    if (!isNil(errorMessage)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: errorMessage,
      });
    }

    errorMessage = null;
    queries.forEach((r) => {
      let error = queryValidation(findSchema, inputs, r.schemaField, r.operation, r.comparisonField);
      if (error !== true) {
        return (errorMessage = error as string);
      }
    });

    Object.keys(params).forEach((key) => {
      const value = params[key];
      found[key] = value;
    });
    found.returns = findSchema.fields;
    found.selectedSchema = findSchema.name;
    
    const updatedSchema = await this.database
      .findByIdAndUpdate("CustomEndpoints", found._id, found)
      .catch((e: any) => (errorMessage = e.message));

    if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    this.customEndpointController.refreshEndpoints();
    return callback(null, { result: JSON.stringify(updatedSchema) });
  }

  async deleteCustomEndpoints(call: any, callback: any) {
    const { id } = JSON.parse(call.request.params);
    if (isNil(id)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: "Id is missing",
      });
    }
    if (id.length === 0) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: "Id must not be empty",
      });
    }
    let errorMessage: any = null;
    const schema = await this.database
      .findOne("CustomEndpoints", { _id: id })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    if (isNil(schema)) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: "Requested Custom Endpoint not found",
      });
    }

    await this.database.deleteOne("CustomEndpoints", { _id: id }).catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    this.customEndpointController.refreshEndpoints();
    return callback(null, { result: "Custom Endpoint deleted" });
  }

  async createCustomEndpoints(call: any, callback: any) {
    const { name, operation, selectedSchema, inputs, queries } = JSON.parse(call.request.params);

    if (isNil(name) || isNil(operation) || isNil(selectedSchema) || isNil(queries)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: "Required fields are missing",
      });
    }
    if (name.length === 0) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: "Name must not be empty",
      });
    }
    if (operation < 0 || operation > 3) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: "Operation is not valid",
      });
    }

    if (selectedSchema.length === 0) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: "SelectedSchema must not be empty",
      });
    }
    let errorMessage: string | null = null;
    const findSchema = await this.database
      .findOne("SchemaDefinitions", {
        _id: selectedSchema,
      })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage) || isNil(findSchema)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: "SelectedSchema not found",
      });
    }

    if (!isNil(inputs) && !Array.isArray(inputs)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: "Inputs must be an array, even if empty!",
      });
    }
    if (!Array.isArray(queries) || queries.length === 0) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: "The queries field must be an array, and not empty!",
      });
    }

    if (!isNil(inputs) && inputs.length > 0) {
      errorMessage = null;
      inputs.forEach((r) => {
        let error = inputValidation(r.name, r.type, r.location);
        if (error !== true) {
          return (errorMessage = error as string);
        }
      });
      if (!isNil(errorMessage)) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: errorMessage,
        });
      }
    }

    errorMessage = null;
    queries.forEach((r) => {
      let error = queryValidation(findSchema, inputs, r.schemaField, r.operation, r.comparisonField);
      if (error !== true) {
        return (errorMessage = error as string);
      }
    });
    if (!isNil(errorMessage)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: errorMessage,
      });
    }
    errorMessage = null;
    const newSchema = await this.database
      .create("CustomEndpoints", {
        name,
        operation,
        selectedSchema: findSchema.name,
        inputs,
        queries,
        returns: findSchema.fields
      })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: "Endpoint Creation failed",
      });
    }
    this.customEndpointController.refreshEndpoints();
    return callback(null, { result: JSON.stringify(newSchema) });
  }
}
