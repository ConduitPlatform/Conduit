import ConduitGrpcSdk, { RouterRequest, RouterResponse } from '@quintessential-sft/conduit-grpc-sdk';
import { inputValidation, queryValidation, assignmentValidation } from './utils';
import grpc from 'grpc';
import { isNil, isPlainObject } from 'lodash';
import schema from '../../models/customEndpoint.schema';
import { CustomEndpointController } from '../../controllers/customEndpoints/customEndpoint.controller';
import { migrateCustomEndpoints } from '../../migrations/customEndpoint.schema.migrations';

const OperationsEnum = {
  GET: 0, //'FIND/GET'
  POST: 1, //'CREATE'
  PUT: 2, //'UPDATE/EDIT'
  DELETE: 3, //'DELETE'
};

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
        console.log('Registered custom endpoints schema');
        return migrateCustomEndpoints(this.grpcSdk);
      })
      .then(() => {
        console.log('customEndpoints migration complete');
      })
      .catch((err: any) => {
        console.log(err);
      });
  }

  async getCustomEndpoints(call: RouterRequest, callback: RouterResponse) {
    let errorMessage: string | null = null;

    const customEndpointsDocs = await this.database
      .findMany('CustomEndpoints', {})
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    return callback(null, { result: JSON.stringify({ results: customEndpointsDocs }) });
  }

  async editCustomEndpoints(call: RouterRequest, callback: RouterResponse) {
    const params = JSON.parse(call.request.params);
    const id = params.id;
    const { inputs, query, selectedSchema, selectedSchemaName, assignments, paginated, sorted } = params;
    if (isNil(id)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'id must not be null',
      });
    }
    let errorMessage: string | null = null;
    delete params.id;
    const found = await this.database
      .findOne('CustomEndpoints', {
        _id: id,
      })
      .catch((e: any) => (errorMessage = e.message));
    if (isNil(found) || !isNil(errorMessage)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Schema not found',
      });
    }
    errorMessage = null;
    let findSchema: any;
    if (!isNil(selectedSchema)) {
      findSchema = await this.database
        .findOne('SchemaDefinitions', {
          _id: selectedSchema,
        })
        .catch((e: any) => (errorMessage = e.message));
      if (!isNil(errorMessage)) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: errorMessage,
        });
      }
    } else if (!isNil(selectedSchemaName)) {
      if (found.operation !== OperationsEnum.GET) {
        return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'Only get requests are allowed for schemas from other modules' });
      }

      findSchema = await this.database.getSchema(selectedSchemaName)
        .catch((e: Error) => (errorMessage = e.message));
      if (!isNil(errorMessage)) {
        return callback({ code: grpc.status.INTERNAL, message: errorMessage });
      }

      findSchema.fields = findSchema.modelSchema;
    }

    if (isNil(findSchema)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'SelectedSchema not found'
      })
    }

    // todo checks for inputs & queries
    if (!Array.isArray(inputs)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Inputs must be an array, even if empty!',
      });
    }
    if (found.operation !== OperationsEnum.POST && !isPlainObject(query)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'The query field must be an object',
      });
    }
    if (
      (found.operation === OperationsEnum.POST ||
        found.operation === OperationsEnum.PUT) &&
      (!Array.isArray(assignments) || assignments.length === 0)
    ) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'The assignments field must be an array, and not empty!',
      });
    }

    errorMessage = null;
    inputs.forEach((r) => {
      let error = inputValidation(r.name, r.type, r.location, r.array);
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

    if (found.operation !== OperationsEnum.POST) {
      errorMessage = null;
      let error = queryValidation(query, findSchema, inputs);
      if (error !== true) {
        errorMessage = error as string;
      }
    }

    if (
      found.operation === OperationsEnum.POST ||
      found.operation === OperationsEnum.PUT
    ) {
      errorMessage = null;
      assignments.forEach(
        (r: {
          schemaField: string;
          action: number;
          assignmentField: { type: string; value: any };
        }) => {
          let error = assignmentValidation(
            findSchema,
            inputs,
            found.operation,
            r.schemaField,
            r.assignmentField,
            r.action
          );
          if (error !== true) {
            return (errorMessage = error as string);
          }
        }
      );
    }

    if (paginated && found.operation !== OperationsEnum.GET) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Cannot add pagination to a non-get endpoint',
      });
    }
    if (sorted && found.operation !== OperationsEnum.GET) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Cannot add sorting to non-get endpoint',
      });
    }

    Object.keys(params).forEach((key) => {
      const value = params[key];
      found[key] = value;
    });
    found.returns = findSchema.name;
    found.selectedSchemaName = findSchema.name;

    const updatedSchema = await this.database
      .findByIdAndUpdate('CustomEndpoints', found._id, found)
      .catch((e: any) => (errorMessage = e.message));

    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    this.customEndpointController.refreshEndpoints();
    return callback(null, { result: JSON.stringify(updatedSchema) });
  }

  async deleteCustomEndpoints(call: RouterRequest, callback: RouterResponse) {
    const { id } = JSON.parse(call.request.params);
    if (isNil(id)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Id is missing',
      });
    }
    if (id.length === 0) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Id must not be empty',
      });
    }
    let errorMessage: any = null;
    const schema = await this.database
      .findOne('CustomEndpoints', { _id: id })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    if (isNil(schema)) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: 'Requested Custom Endpoint not found',
      });
    }

    await this.database
      .deleteOne('CustomEndpoints', { _id: id })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    this.customEndpointController.refreshEndpoints();
    return callback(null, { result: 'Custom Endpoint deleted' });
  }

  async createCustomEndpoints(call: RouterRequest, callback: RouterResponse) {
    const {
      name,
      operation,
      selectedSchema,
      selectedSchemaName,
      inputs,
      query,
      authentication,
      assignments,
      sorted,
      paginated,
    } = JSON.parse(call.request.params);

    if (isNil(name) || isNil(operation) || (isNil(selectedSchema) && isNil(selectedSchemaName))) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Required fields are missing',
      });
    }
    if (name.length === 0) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Name must not be empty',
      });
    }
    if (operation < 0 || operation > 3) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Operation is not valid',
      });
    }
    if (operation !== OperationsEnum.POST && isNil(query)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Required fields are missing',
      });
    }
    if (
      (operation === OperationsEnum.POST || operation === OperationsEnum.PUT) &&
      isNil(assignments)
    ) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Required fields are missing',
      });
    }

    let findSchema: any;
    let errorMessage: string | null = null;
    if (!isNil(selectedSchema)) {
      if (selectedSchema.length === 0) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'SelectedSchema must not be empty',
        });
      }

      findSchema = await this.database
        .findOne('SchemaDefinitions', {
          _id: selectedSchema,
        })
        .catch((e: any) => (errorMessage = e.message));
      if (!isNil(errorMessage)) {
        return callback({
          code: grpc.status.INTERNAL,
          message: errorMessage,
        });
      }
    } else {
      if (selectedSchemaName.length === 0) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'SelectedSchemaName must not be empty',
        });
      }

      if (operation !== OperationsEnum.GET) {
        return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'Only get requests are allowed for schemas from other modules' });
      }

      findSchema = await this.database.getSchema(selectedSchemaName)
        .catch((e: Error) => (errorMessage = e.message));
      if (!isNil(errorMessage)) {
        return callback({ code: grpc.status.INTERNAL, message: errorMessage });
      }

      findSchema.fields = findSchema.modelSchema;
    }

    if (isNil(findSchema)) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'SelectedSchema not found' });
    }

    if (!isNil(inputs) && !Array.isArray(inputs)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Inputs must be an array, even if empty!',
      });
    }
    if (operation !== OperationsEnum.POST && !isPlainObject(query)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'The query field must be an object',
      });
    }
    if (
      (operation === OperationsEnum.POST || operation === OperationsEnum.PUT) &&
      (!Array.isArray(assignments) || assignments.length === 0)
    ) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'The assigment field must be an array, and not empty!',
      });
    }

    if (!isNil(inputs) && inputs.length > 0) {
      errorMessage = null;
      inputs.forEach((r) => {
        let error = inputValidation(r.name, r.type, r.location, r.array);
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

    let endpoint = {
      name,
      operation,
      selectedSchema,
      selectedSchemaName: findSchema.name,
      inputs,
      authentication,
      paginated: false,
      sorted: false,
      returns: findSchema.name,
      query: null,
      assignments: null,
    };

    if (paginated && operation !== OperationsEnum.GET) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Cannot add pagination to non-get endpoint',
      });
    } else if (paginated) {
      endpoint.paginated = paginated;
    }

    if (sorted && operation !== OperationsEnum.GET) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Cannot add sorting to non-get endpoint',
      });
    } else if (sorted) {
      endpoint.sorted = sorted;
    }

    if (operation !== OperationsEnum.POST) {
      let error = queryValidation(query, findSchema, inputs);
      if (error !== true) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: error as string,
        });
      }
      endpoint.query = query;
    }

    if (operation === OperationsEnum.POST || operation === OperationsEnum.PUT) {
      errorMessage = null;
      assignments.forEach(
        (r: {
          schemaField: any;
          action: number;
          assignmentField: { type: string; value: any };
        }) => {
          let error = assignmentValidation(
            findSchema,
            inputs,
            operation,
            r.schemaField,
            r.assignmentField,
            r.action
          );
          if (error !== true) {
            return (errorMessage = error as string);
          }
        }
      );
      if (!isNil(errorMessage)) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: errorMessage,
        });
      }
      endpoint.assignments = assignments;
    }

    errorMessage = null;
    const newSchema = await this.database
      .create('CustomEndpoints', endpoint)
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Endpoint Creation failed',
      });
    }
    this.customEndpointController.refreshEndpoints();
    return callback(null, { result: JSON.stringify(newSchema) });
  }
}
