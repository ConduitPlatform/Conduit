import ConduitGrpcSdk, {
  ConduitModel,
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
  paramValidation,
  operationValidation,
  paginationAndSortingValidation,
} from './utils';
import { isNil } from 'lodash';
import { CustomEndpointController } from '../../controllers/customEndpoints/customEndpoint.controller';
import { DatabaseAdapter } from '../../adapters/DatabaseAdapter';
import { MongooseSchema } from '../../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../../adapters/sequelize-adapter/SequelizeSchema';
import escapeStringRegexp from 'escape-string-regexp';
import { IDeclaredSchema } from '../../interfaces';

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
    const { schemaId, schemaName, fields, compiledFields } =
      await this.getAccessibleSchemaFields(operation, selectedSchema, selectedSchemaName);
    let error = paramValidation(call.request.params);
    if (error !== true) {
      throw new GrpcError(status.INVALID_ARGUMENT, error as string);
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
      selectedSchema: schemaId,
      selectedSchemaName: schemaName,
      inputs,
      authentication,
      paginated: false,
      sorted: false,
      returns: schemaName,
      query: null,
      assignments: null,
    };
    error = paginationAndSortingValidation(operation, call, compiledFields, endpoint);
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
            fields,
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

    const { schemaName, fields, compiledFields } = await this.getAccessibleSchemaFields(
      operation,
      selectedSchema,
      selectedSchemaName,
    );

    let error = operationValidation(operation, query, assignments);
    if (error !== true) {
      throw new GrpcError(status.INVALID_ARGUMENT, error as string);
    }
    error = inputValidation(inputs);
    if (error !== true) {
      throw new GrpcError(status.INVALID_ARGUMENT, error as string);
    }
    error = paginationAndSortingValidation(operation, call, compiledFields, null);
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
            fields,
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
    found.returns = schemaName;
    found.selectedSchemaName = schemaName;

    const customEndpoint = await this.database
      .getSchemaModel('CustomEndpoints')
      .model.findByIdAndUpdate(found._id, found)
      .catch(e => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    if (isNil(customEndpoint)) {
      throw new GrpcError(status.INTERNAL, 'Could not update custom endpoint');
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

  async schemaDetailsForOperation(
    call: ParsedRouterRequest,
  ): Promise<UnparsedRouterResponse> {
    const { schemaId, operation } = call.request.params;
    const { schemaName, fields: accessibleFields } = await this.getAccessibleSchemaFields(
      operation,
      schemaId,
    );
    return { schemaId, schemaName, accessibleFields };
  }

  private async getAccessibleSchemaFields(
    operation: number,
    schemaId?: string,
    schemaName?: string,
  ): Promise<{
    schemaId: string;
    schemaName: string;
    fields: ConduitModel;
    compiledFields: ConduitModel;
  }> {
    if (!schemaId && !schemaName) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Specify schema id or name');
    }
    const schema: IDeclaredSchema = await this.database
      .getSchemaModel('_DeclaredSchema')
      .model.findOne({
        $and: [
          { name: { $nin: this.database.systemSchemas } },
          schemaId ? { _id: schemaId } : { name: schemaName },
        ],
      });
    if (!schema) {
      throw new GrpcError(
        status.NOT_FOUND,
        `Schema does not exist or can't be used by CMS`,
      );
    }
    schemaId = schema._id.toString();
    schemaName = schema.name;
    // Field Accessibility Checks
    const perms = schema.modelOptions.conduit?.permissions!;
    if (!perms && operation !== OperationsEnum.GET) {
      // This is almost certainly never undefined, but adding this just in case... // TODO: Remove after type cleanup
      const error = `Schema '${schema.name}' does not define any permissions! Can't create non-GET custom endpoint!`;
      ConduitGrpcSdk.Logger.error(error);
      throw new GrpcError(status.FAILED_PRECONDITION, error);
    }
    if (operation === OperationsEnum.GET) {
      return {
        schemaId,
        schemaName,
        fields: schema.compiledFields,
        compiledFields: schema.compiledFields,
      };
    } else if (operation === OperationsEnum.POST) {
      const fields = perms.canCreate ? schema.compiledFields : {};
      return { schemaId, schemaName, fields, compiledFields: schema.compiledFields };
    } else if ([OperationsEnum.PATCH, OperationsEnum.PUT].includes(operation)) {
      const fields =
        perms.canModify === 'Everything'
          ? schema.compiledFields
          : perms.canModify === 'ExtensionOnly'
          ? perms.extendable
            ? schema.extensions.find(ext => ext.ownerModule === 'database')?.fields ?? {}
            : {}
          : {};
      return { schemaId, schemaName, fields, compiledFields: schema.compiledFields };
    } else if (operation === OperationsEnum.DELETE) {
      const fields = perms.canDelete ? schema.compiledFields : {};
      return { schemaId, schemaName, fields, compiledFields: schema.compiledFields };
    } else {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Unknown Operation');
    }
  }
}
