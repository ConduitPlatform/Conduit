import ConduitGrpcSdk, {
  ConduitSchema,
  GrpcError,
  Indexable,
  ParsedRouterRequest,
  Query,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import {
  assignmentValidation,
  inputValidation,
  queryValidation,
  paramValidation,
  operationValidation,
  paginationAnsSortingValidation,
} from './utils';
import { isNil } from 'lodash';
import { CustomEndpointController } from '../../controllers/customEndpoints/customEndpoint.controller';
import { DatabaseAdapter } from '../../adapters/DatabaseAdapter';
import { MongooseSchema } from '../../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../../adapters/sequelize-adapter/SequelizeSchema';
import escapeStringRegexp from 'escape-string-regexp';
import { ConduitDatabaseSchema } from '../../interfaces';

export const OperationsEnum = {
  // That's a dictionary, not an enum. TODO: Rename and/or convert to enum/map.
  GET: 0, //'FIND/GET'
  POST: 1, //'CREATE'
  PUT: 2, //'UPDATE/EDIT'
  DELETE: 3, //'DELETE'
  PATCH: 4, //'PATCH'
};

export class CustomEndpointsAdmin {
  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly database: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
    private readonly customEndpointController: CustomEndpointController,
  ) {}

  async getCustomEndpoints(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { schemaName, sort } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    let identifier,
      query: Query = {};
    if (!isNil(call.request.params.search)) {
      identifier = escapeStringRegexp(call.request.params.search);
      query['name'] = { $regex: `.*${identifier}.*`, $options: 'i' };
    }
    if (!isNil(call.request.params.operation)) {
      query['operation'] = call.request.params.operation;
    }
    if (schemaName && schemaName.length !== 0) {
      query = {
        $and: [query, { selectedSchemaName: { $in: schemaName } }],
      };
    }
    const customEndpoints = await this.database
      .getSchemaModel('CustomEndpoints')
      .model.findMany(query, skip, limit, undefined, sort);
    const count: number = await this.database
      .getSchemaModel('CustomEndpoints')
      .model.countDocuments(query);

    return { customEndpoints, count };
  }

  async createCustomEndpoint(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const {
      name,
      operation,
      selectedSchema, // if changed, update utils.selectedSchemaValidation() throw message
      selectedSchemaName, // ^
      inputs,
      query,
      authentication,
      assignments,
      sorted,
      paginated,
    } = call.request.params;

    const customEndpointExists = await this.database
      .getSchemaModel('CustomEndpoints')
      .model.findOne({ name });
    if (customEndpointExists) {
      throw new GrpcError(
        status.ALREADY_EXISTS,
        `${name} custom endpoint already exists`,
      );
    }
    let error = paramValidation(call.request.params);
    if (error !== true) {
      throw new GrpcError(status.INVALID_ARGUMENT, error as string);
    }
    const findSchema = await this.findSchema(
      selectedSchema,
      selectedSchemaName,
      operation,
    );
    if (isNil(findSchema)) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }
    error = operationValidation(operation, query, assignments);
    if (error !== true) {
      throw new GrpcError(status.INVALID_ARGUMENT, error as string);
    }
    error = inputValidation(inputs);
    if (error !== true) {
      throw new GrpcError(status.INVALID_ARGUMENT, error as string);
    }

    const endpoint = {
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
    error = paginationAnsSortingValidation(
      operation,
      call,
      findSchema as ConduitDatabaseSchema,
      endpoint,
    );
    if (error !== true) {
      throw new GrpcError(status.INVALID_ARGUMENT, error as string);
    }
    if (paginated && operation !== OperationsEnum.GET) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Cannot add pagination to non-get endpoint',
      );
    } else if (paginated) {
      endpoint.paginated = paginated;
    }
    if (sorted && operation !== OperationsEnum.GET) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Cannot add sorting to non-get endpoint',
      );
    } else if (sorted) {
      endpoint.sorted = sorted;
    }
    if (operation !== OperationsEnum.POST) {
      const error = queryValidation(
        query,
        findSchema as ConduitDatabaseSchema, // @dirty-type-cast
        inputs,
      );
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
          schemaField: string;
          action: number;
          assignmentField: { type: string; value: Indexable };
        }) => {
          const error = assignmentValidation(
            findSchema,
            inputs,
            operation,
            r.schemaField,
            r.assignmentField,
            r.action,
          );
          if (error !== true) {
            throw new GrpcError(status.INVALID_ARGUMENT, error as string);
          }
        },
      );
      endpoint.assignments = assignments;
    }

    const customEndpoint = await this.database
      .getSchemaModel('CustomEndpoints')
      .model.create(endpoint);
    if (isNil(customEndpoint)) {
      throw new GrpcError(status.INTERNAL, 'Endpoint creation failed');
    }
    this.customEndpointController.refreshEndpoints();
    return customEndpoint;
  }

  async patchCustomEndpoint(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, selectedSchema, selectedSchemaName, query, inputs, assignments } =
      call.request.params;

    if (isNil(selectedSchema) && isNil(selectedSchemaName)) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Either selectedSchema or selectedSchemaName must be specified',
      );
    }

    const found = await this.database
      .getSchemaModel('CustomEndpoints')
      .model.findOne({ _id: id });
    if (isNil(found)) {
      throw new GrpcError(status.NOT_FOUND, 'Custom endpoint does not exist');
    }

    const operation = found.operation;

    const findSchema = await this.findSchema(
      selectedSchema,
      selectedSchemaName,
      operation,
    );
    if (isNil(findSchema)) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }

    let error = operationValidation(operation, query, assignments);
    if (error !== true) {
      throw new GrpcError(status.INVALID_ARGUMENT, error as string);
    }

    error = inputValidation(inputs);
    if (error !== true) {
      throw new GrpcError(status.INVALID_ARGUMENT, error as string);
    }

    error = paginationAnsSortingValidation(
      operation,
      call,
      findSchema as ConduitDatabaseSchema,
      null,
    );
    if (error !== true) {
      throw new GrpcError(status.INVALID_ARGUMENT, error as string);
    }

    if (
      operation === OperationsEnum.POST ||
      operation === OperationsEnum.PUT ||
      operation === OperationsEnum.PATCH
    ) {
      assignments.forEach(
        (r: {
          schemaField: string;
          action: number;
          assignmentField: { type: string; value: Indexable };
        }) => {
          const error = assignmentValidation(
            findSchema,
            inputs,
            operation,
            r.schemaField,
            r.assignmentField,
            r.action,
          );
          if (error !== true) {
            throw new GrpcError(status.INVALID_ARGUMENT, error as string);
          }
        },
      );
    }

    delete call.request.params.id;
    delete call.request.params.name;
    Object.keys(call.request.params).forEach(key => {
      // TODO: "Bugs are Welcome", we should clean this up
      found[key] = call.request.params[key];
    });
    found.returns = findSchema.name;
    found.selectedSchemaName = findSchema.name;

    const customEndpoint = await this.database
      .getSchemaModel('CustomEndpoints')
      .model.findByIdAndUpdate(found._id, found)
      .catch(e => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    if (isNil(customEndpoint)) {
      throw new GrpcError(status.INTERNAL, 'Could not update schema');
    }

    this.customEndpointController.refreshEndpoints();
    return customEndpoint;
  }

  async deleteCustomEndpoint(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    if (call.request.params.id.length === 0) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'id must not be empty');
    }
    const customEndpoint = await this.database
      .getSchemaModel('CustomEndpoints')
      .model.findOne({ _id: call.request.params.id });
    if (isNil(customEndpoint)) {
      throw new GrpcError(status.NOT_FOUND, 'Custom endpoint does not exist');
    }
    await this.database
      .getSchemaModel('CustomEndpoints')
      .model.deleteOne({ _id: call.request.params.id })
      .catch(e => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    this.customEndpointController.refreshEndpoints();
    ConduitGrpcSdk.Metrics?.decrement('custom_endpoints_total');
    return 'Custom Endpoint deleted';
  }

  async getSchemasWithCustomEndpoints(
    call: ParsedRouterRequest,
  ): Promise<UnparsedRouterResponse> {
    const { sort } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    const schemaIds: string[] = [];
    const schemaNames: string[] = [];
    const customEndpoints = await this.database
      .getSchemaModel('CustomEndpoints')
      .model.findMany({}, skip, limit, 'selectedSchema selectedSchemaName', sort);
    customEndpoints.forEach((endpoint: Indexable) => {
      if (!schemaIds.includes(endpoint.selectedSchema.toString())) {
        schemaIds.push(endpoint.selectedSchema.toString());
        schemaNames.push(endpoint.selectedSchemaName);
      }
    });
    const schemas: { id: string; name: string }[] = [];
    for (let i = 0; i < schemaIds.length; i++) {
      schemas.push({
        id: schemaIds[i],
        name: schemaNames[i],
      });
    }
    return { schemas };
  }

  private async findSchema(
    selectedSchema: string,
    selectedSchemaName: string,
    operation: number,
  ): Promise<ConduitSchema | null> {
    if (!isNil(selectedSchema)) {
      // Find schema using selectedSchema
      return this.database
        .getSchemaModel('_DeclaredSchema')
        .model.findOne({ _id: selectedSchema });
    } else {
      // Find schema using selectedSchemaName
      if (operation !== OperationsEnum.GET) {
        throw new GrpcError(
          status.INVALID_ARGUMENT,
          'Only get requests are allowed for schemas from other modules',
        );
      }
      return this.database.getSchema(selectedSchemaName);
    }
  }
}
