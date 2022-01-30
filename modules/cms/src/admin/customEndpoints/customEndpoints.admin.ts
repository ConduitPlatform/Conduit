import ConduitGrpcSdk, {
  DatabaseProvider,
  ParsedRouterRequest,
  UnparsedRouterResponse,
  GrpcError,
} from '@conduitplatform/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import { inputValidation, queryValidation, assignmentValidation } from './utils';
import { isNil, isPlainObject } from 'lodash';
import escapeStringRegexp from 'escape-string-regexp';
import { CustomEndpointController } from '../../controllers/customEndpoints/customEndpoint.controller';
import { _DeclaredSchema, CustomEndpoints } from '../../models';

export const OperationsEnum = { // That's a dictionary, not an enum. TODO: Rename and/or convert to enum/map.
  GET: 0, //'FIND/GET'
  POST: 1, //'CREATE'
  PUT: 2, //'UPDATE/EDIT'
  DELETE: 3, //'DELETE'
  PATCH: 4, //'PATCH'
};

export class CustomEndpointsAdmin {
  private readonly database!: DatabaseProvider;

  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly customEndpointController: CustomEndpointController
  ) {
    this.database = this.grpcSdk.databaseProvider!;
  }

  async getCustomEndpoints(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    let identifier, query : any = {};
    if (!isNil(call.request.params.search)) {
      identifier = escapeStringRegexp(call.request.params.search);
      query['name'] = { $regex: `.*${identifier}.*`, $options: 'i' };
    }
    if (!isNil(call.request.params.operation)) {
      query['operation'] = call.request.params.operation;
    }
    const customEndpoints = await CustomEndpoints.getInstance()
      .findMany(
        query,
        undefined,
        skip,
        limit,
      );
    const count: number = await CustomEndpoints.getInstance().countDocuments(query);

    return { customEndpoints, count };
  }

  async createCustomEndpoint(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
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
    } = call.request.params;

    if (isNil(selectedSchema) && isNil(selectedSchemaName)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Either selectedSchema or selectedSchemaName must be specified');
    }
    if (name.length === 0) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'name must not be empty');
    }
    if (operation < 0 || operation > 4) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'operation is not valid');
    }
    if (operation !== OperationsEnum.POST && isNil(query)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Specified operation requires that query field also be provided');
    }
    if (
      (operation === OperationsEnum.POST ||
        operation === OperationsEnum.PUT ||
        operation === OperationsEnum.PATCH) &&
      isNil(assignments)
    ) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Specified operation requires that assignments field also be provided');
    }

    let findSchema: any;
    if (!isNil(selectedSchema)) {
      // Find schema using selectedSchema
      if (selectedSchema.length === 0) {
        throw new GrpcError(status.INVALID_ARGUMENT, 'selectedSchema must not be empty');
      }
      findSchema = await _DeclaredSchema.getInstance().findOne({ _id: selectedSchema });
    } else {
      // Find schema using selectedSchemaName
      if (selectedSchemaName.length === 0) {
        throw new GrpcError(status.INVALID_ARGUMENT, 'selectedSchemaName must not be empty');
      }
      if (operation !== OperationsEnum.GET) {
        throw new GrpcError(status.INVALID_ARGUMENT, 'Only get requests are allowed for schemas from other modules');
      }
      findSchema = await this.database.getSchema(selectedSchemaName)
      findSchema.fields = findSchema.modelSchema;
    }

    if (isNil(findSchema)) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }
    if (operation !== OperationsEnum.POST && !isPlainObject(query)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'The query field must be an object');
    }
    if (
      (operation === OperationsEnum.POST ||
        operation === OperationsEnum.PUT ||
        operation === OperationsEnum.PATCH) &&
      (!Array.isArray(assignments) || assignments.length === 0)
    ) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Specified operation requires that assignments field be a non-empty array');
    }
    if (!isNil(inputs) && inputs.length > 0) {
      inputs.forEach((r: any) => {
        let error = inputValidation(r.name, r.type, r.location, r.array);
        if (error !== true) {
          throw new GrpcError(status.INVALID_ARGUMENT, error as string);
        }
      });
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
      throw new GrpcError(status.INVALID_ARGUMENT, 'Cannot add pagination to non-get endpoint');
    } else if (paginated) {
      endpoint.paginated = paginated;
    }
    if (sorted && operation !== OperationsEnum.GET) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Cannot add sorting to non-get endpoint');
    } else if (sorted) {
      endpoint.sorted = sorted;
    }
    if (operation !== OperationsEnum.POST) {
      let error = queryValidation(query, findSchema, inputs);
      if (error !== true) {
        throw new GrpcError(status.INVALID_ARGUMENT, error as string);
      }
      endpoint.query = query;
    }
    if (
      operation === OperationsEnum.POST ||
      operation === OperationsEnum.PUT ||
      operation === OperationsEnum.PATCH
    ) {
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
            throw new GrpcError(status.INVALID_ARGUMENT, error as string);
          }
        }
      );
      endpoint.assignments = assignments;
    }

    const customEndpoint = await CustomEndpoints.getInstance().create(endpoint);
    if (isNil(customEndpoint)) {
      throw new GrpcError(status.INTERNAL, 'Endpoint creation failed');
    }
    this.customEndpointController.refreshEndpoints();
    return customEndpoint;
  }

  async patchCustomEndpoint(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const params = call.request.params;
    const {
      id,
      selectedSchema,
      selectedSchemaName,
      query,
      inputs,
      assignments,
      sorted,
      paginated,
    } = params;

    if (isNil(selectedSchema) && isNil(selectedSchemaName)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Either selectedSchema or selectedSchemaName must be specified');
    }

    const found = await CustomEndpoints.getInstance().findOne({ _id: id });
    if (isNil(found)) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }

    let findSchema: any;
    if (!isNil(selectedSchema)) {
      // Find schema using selectedSchema
      findSchema = await _DeclaredSchema.getInstance().findOne({ _id: selectedSchema })
      if (isNil(findSchema)) {
        throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
      }
    } else if (!isNil(selectedSchemaName)) {
      // Find schema using selectedSchemaName
      if (found.operation !== OperationsEnum.GET) {
        throw new GrpcError(status.INVALID_ARGUMENT, 'Only get requests are allowed for schemas from other modules');
      }
      findSchema = await this.database.getSchema(selectedSchemaName)
      findSchema.fields = findSchema.modelSchema;
    }

    if (isNil(findSchema)) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }
    if (found.operation !== OperationsEnum.POST && !isPlainObject(query)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'The query field must be an object');
    }
    if (
      (found.operation === OperationsEnum.POST ||
        found.operation === OperationsEnum.PUT ||
        found.operation === OperationsEnum.PATCH) &&
      (!Array.isArray(assignments) || assignments.length === 0)
    ) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Custom endpoint\'s target operation requires that assignments field be a non-empty array');
    }
    if (!isNil(inputs) && inputs.length > 0) {
      inputs.forEach((r: any) => {
        let error = inputValidation(r.name, r.type, r.location, r.array);
        if (error !== true) {
          throw new GrpcError(status.INVALID_ARGUMENT, error as string);
        }
      });
    }

    if (paginated && found.operation !== OperationsEnum.GET) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Cannot add pagination to non-get endpoint');
    }
    if (sorted && found.operation !== OperationsEnum.GET) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Cannot add sorting to non-get endpoint');
    }
    if (found.operation !== OperationsEnum.POST) {
      let error = queryValidation(query, findSchema, inputs);
      if (error !== true) {
        throw new GrpcError(status.INVALID_ARGUMENT, error as string);
      }
    }

    if (
      found.operation === OperationsEnum.POST ||
      found.operation === OperationsEnum.PUT ||
      found.operation === OperationsEnum.PATCH
    ) {
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
            throw new GrpcError(status.INVALID_ARGUMENT, error as string);
          }
        }
      );
    }

    delete params.id;
    Object.keys(params).forEach((key) => {
      // @ts-ignore
      found[key] = params[key];
    });
    found.returns = findSchema.name;
    found.selectedSchemaName = findSchema.name;

    const customEndpoint = await CustomEndpoints.getInstance()
      .findByIdAndUpdate(found._id, found)
      .catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });
    if (isNil(customEndpoint)) {
      throw new GrpcError(status.INTERNAL, 'Could not update schema')
    }

    this.customEndpointController.refreshEndpoints();
    return customEndpoint;
  }

  async deleteCustomEndpoint(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    if (call.request.params.id.length === 0) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'id must not be empty');
    }
    const customEndpoint = await CustomEndpoints.getInstance().findOne({ _id: call.request.params.id });
    if (isNil(customEndpoint)) {
      throw new GrpcError(status.NOT_FOUND, 'Custom endpoint does not exist');
    }
    await CustomEndpoints.getInstance().deleteOne({ _id: call.request.params.id })
      .catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });
    this.customEndpointController.refreshEndpoints();
    return 'Custom Endpoint deleted';
  }
}
