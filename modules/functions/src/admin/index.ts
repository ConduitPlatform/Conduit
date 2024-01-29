import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
  ParsedRouterRequest,
  Query,
  TYPE,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitBoolean,
  ConduitJson,
  ConduitNumber,
  ConduitString,
  GrpcServer,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { isEmpty, isNil } from 'lodash-es';
import { status } from '@grpc/grpc-js';
import { FunctionExecutions, Functions } from '../models/index.js';
import { FunctionController } from '../controllers/function.controller.js';
import { VMScript } from 'vm2';

import escapeStringRegexp from 'escape-string-regexp';

export class AdminHandlers {
  private readonly routingManager: RoutingManager;

  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly functionsController: FunctionController,
  ) {
    this.routingManager = new RoutingManager(this.grpcSdk.admin, this.server);
    this.registerAdminRoutes();
  }

  async uploadFunction(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { name, functionType, functionCode, inputs, returns } = call.request.params;
    const func = await Functions.getInstance().findOne({ name: name });
    if (!isNil(func)) {
      throw new GrpcError(status.ALREADY_EXISTS, 'function name already exists');
    }
    const script = `module.exports = function(grpcSdk,req,res) { ${functionCode} }`;
    try {
      new VMScript(script).compile();
    } catch (e) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid function code');
    }
    const timeoutValue = inputs.timeout ?? 180000;
    const query = {
      name,
      functionType,
      functionCode,
      inputs,
      returns,
      timeout: timeoutValue,
    };
    const functionEndpoint = await Functions.getInstance().create(query);
    this.functionsController.refreshEndpoints();
    return functionEndpoint;
  }

  async deleteFunction(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id } = call.request.params;
    if (isEmpty(id) || isNil(id)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid id');
    }
    const func = await Functions.getInstance().findOne({ _id: id });
    if (isNil(func)) {
      throw new GrpcError(status.NOT_FOUND, 'Function does not exist');
    }
    await Functions.getInstance().deleteOne({ _id: id });
    this.functionsController.refreshEndpoints();
    return 'Deleted';
  }

  async deleteFunctions(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { ids } = call.request.params;
    if (isEmpty(ids) || isNil(ids)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid ids');
    }
    const func = await Functions.getInstance().findMany({ _id: { $in: ids } });
    if (isNil(func) || isEmpty(func) || func.length !== ids.length) {
      throw new GrpcError(status.NOT_FOUND, 'One or more functions do not exist');
    }
    await Functions.getInstance().deleteMany({ _id: { $in: ids } });
    this.functionsController.refreshEndpoints();
    return 'Deleted';
  }

  async listFunctions(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { sort, search } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    let query: Query<Functions> = {};
    if (!isNil(search)) {
      if (call.request.params.search.match(/^[a-fA-F\d]{24}$/)) {
        query = { _id: call.request.params.search };
      } else {
        const identifier = escapeStringRegexp(call.request.params.search);
        query = { name: { $regex: `.*${identifier}.*`, $options: 'i' } };
      }
    }
    const functions = await Functions.getInstance().findMany(
      query,
      undefined,
      skip,
      limit,
      sort,
    );
    const count = await Functions.getInstance().countDocuments(query);
    return { functions, count };
  }

  async getFunction(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id } = call.request.params;
    const func = await Functions.getInstance().findOne({ _id: id });
    if (isNil(func)) {
      throw new GrpcError(status.NOT_FOUND, 'Function does not exist');
    }
    return func;
  }

  async updateFunction(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, name, functionCode, inputs, returns, timeout } = call.request.params;
    const func = await Functions.getInstance().findOne({ _id: id });
    if (isNil(func)) {
      throw new GrpcError(status.NOT_FOUND, 'Function does not exist');
    }
    const query = {
      name: name ?? func.name,
      functionCode: functionCode ?? func.functionCode,
      inputs: inputs ?? func.inputs,
      returns: returns ?? func.returns,
      timeout: timeout ?? func.timeout,
    };
    await Functions.getInstance().findByIdAndUpdate(func._id, query);
    this.functionsController.refreshEndpoints();
    return { updated: true };
  }

  async getFunctionsExecutions(
    call: ParsedRouterRequest,
  ): Promise<UnparsedRouterResponse> {
    const { sort } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;

    const functionsExecutions = await FunctionExecutions.getInstance().findMany(
      {},
      skip,
      limit,
      sort,
    );
    return functionsExecutions;
  }

  async getFunctionExecutions(
    call: ParsedRouterRequest,
  ): Promise<UnparsedRouterResponse> {
    const { functionName, success } = call.request.params;
    const functionExecutions = await FunctionExecutions.getInstance().findMany({
      functionName: functionName,
      success: success,
    });
    if (isNil(functionExecutions) || isEmpty(functionExecutions)) {
      throw new GrpcError(status.NOT_FOUND, 'Function Executions not exist');
    }
    return functionExecutions;
  }

  private registerAdminRoutes() {
    this.routingManager.clear();
    this.routingManager.route(
      {
        path: '/upload',
        action: ConduitRouteActions.POST,
        description: 'Upload a function',
        bodyParams: {
          name: ConduitString.Required,
          functionCode: ConduitString.Required,
          functionType: ConduitString.Required,
          inputs: ConduitJson.Optional,
          returns: ConduitJson.Optional,
          timeout: ConduitNumber.Optional,
        },
      },
      new ConduitRouteReturnDefinition(Functions.name),
      this.uploadFunction.bind(this),
    );
    this.routingManager.route(
      {
        path: '/',
        action: ConduitRouteActions.DELETE,
        description: 'Deletes multiple functions',
        queryParams: {
          ids: { type: [TYPE.String], required: true },
        },
      },
      new ConduitRouteReturnDefinition('DeleteFunctions', 'String'),
      this.deleteFunctions.bind(this),
    );
    this.routingManager.route(
      {
        path: '/:id',
        action: ConduitRouteActions.DELETE,
        description: 'Delete a function',
        urlParams: {
          id: { type: TYPE.String, required: true },
        },
      },
      new ConduitRouteReturnDefinition('DeleteFunction', 'String'),
      this.deleteFunction.bind(this),
    );

    this.routingManager.route(
      {
        path: '/',
        action: ConduitRouteActions.GET,
        description: 'List all functions',
        queryParams: {
          search: ConduitString.Optional,
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          sort: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('ListFunctions', {
        functions: [Functions.getInstance().fields],
        count: ConduitNumber.Required,
      }),
      this.listFunctions.bind(this),
    );
    this.routingManager.route(
      {
        path: '/:id',
        action: ConduitRouteActions.GET,
        description: 'Get a function',
        urlParams: {
          id: { type: TYPE.String, required: true },
        },
      },
      new ConduitRouteReturnDefinition('GetFunction', 'String'),
      this.getFunction.bind(this),
    );
    this.routingManager.route(
      {
        path: '/list/executions',
        action: ConduitRouteActions.GET,
        description: 'List all functions executions',
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          sort: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('ListFunctionsExecutions', 'String'),
      this.getFunctionsExecutions.bind(this),
    );
    this.routingManager.route(
      {
        path: '/executions/:functionName',
        action: ConduitRouteActions.GET,
        description: 'Get function executions for specific function',
        urlParams: {
          functionName: { type: TYPE.String, required: true },
        },
        queryParams: {
          success: ConduitBoolean.Optional,
        },
      },
      new ConduitRouteReturnDefinition('GetFunctionExecutions', 'String'),
      this.getFunctionExecutions.bind(this),
    );
    this.routingManager.route(
      {
        path: '/:id',
        action: ConduitRouteActions.PATCH,
        description: 'Update a function',
        urlParams: {
          id: { type: TYPE.String, required: true },
        },
        bodyParams: {
          name: ConduitString.Optional,
          functionCode: ConduitString.Optional,
          inputs: ConduitJson.Optional,
          returns: ConduitJson.Optional,
          timeout: ConduitNumber.Optional,
        },
      },
      new ConduitRouteReturnDefinition('UpdateFunction', 'String'),
      this.updateFunction.bind(this),
    );
    this.routingManager.registerRoutes();
  }
}
