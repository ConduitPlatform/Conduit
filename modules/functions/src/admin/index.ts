import ConduitGrpcSdk, {
  ConduitBoolean,
  ConduitNumber,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  GrpcError,
  GrpcServer,
  ParsedRouterRequest,
  RouteOptionType,
  RoutingManager,
  TYPE,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { isEmpty, isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import { FunctionDefinitions, Functions } from '../models';

export class AdminHandlers {
  private readonly routingManager: RoutingManager;

  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
  ) {
    this.routingManager = new RoutingManager(this.grpcSdk.admin, this.server);
    this.registerAdminRoutes();
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
          inputs: { type: TYPE.JSON, required: false },
          returns: { type: TYPE.JSON, required: false },
          timeout: ConduitNumber.Optional,
        },
      },
      new ConduitRouteReturnDefinition(Functions.name),
      this.uploadFunction.bind(this),
    );
    this.routingManager.route(
      {
        path: '/:id',
        action: ConduitRouteActions.DELETE,
        description: 'Delete a function',
        urlParams: {
          id: { type: RouteOptionType.String, required: true },
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
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          sort: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('ListFunctions', 'String'),
      this.listFunctions.bind(this),
    );
    this.routingManager.route(
      {
        path: '/:id',
        action: ConduitRouteActions.GET,
        description: 'Get a function',
        urlParams: {
          id: { type: RouteOptionType.String, required: true },
        },
      },
      new ConduitRouteReturnDefinition('GetFunction', 'String'),
      this.getFunction.bind(this),
    );
    this.routingManager.route(
      {
        path: '/definitions',
        action: ConduitRouteActions.GET,
        description: 'List all functions definitions',
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          sort: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('ListFunctionsDefinitions', 'String'),
      this.getFunctionsDefinitions.bind(this),
    );
    this.routingManager.route(
      {
        path: '/definitions/:functionName',
        action: ConduitRouteActions.GET,
        description: 'Get function Definitions for specific function',
        urlParams: {
          functionName: { type: RouteOptionType.String, required: true },
        },
        queryParams: {
          success: ConduitBoolean.Optional,
        },
      },
      new ConduitRouteReturnDefinition('GetFunctionDefinitions', 'String'),
      this.getFunctionDefinitions.bind(this),
    );
    this.routingManager.route(
      {
        path: '/:id',
        action: ConduitRouteActions.PATCH,
        description: 'Update a function',
        urlParams: {
          id: { type: RouteOptionType.String, required: true },
        },
        bodyParams: {
          name: ConduitString.Optional,
          functionCode: ConduitString.Optional,
          inputs: { type: TYPE.JSON, required: false },
          returns: { type: TYPE.JSON, required: false },
          timeout: ConduitNumber.Optional,
        },
      },
      new ConduitRouteReturnDefinition('UpdateFunction', 'String'),
      this.updateFunction.bind(this),
    );
    this.routingManager.registerRoutes();
  }

  async uploadFunction(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { name, functionCode, inputs, returns } = call.request.params;
    const func = await Functions.getInstance().findOne({ name: name });
    if (!isNil(func)) {
      throw new GrpcError(status.ALREADY_EXISTS, 'function name already exists');
    }
    const timeoutValue = inputs.timeout ?? 180000;
    const query = {
      name,
      functionCode,
      inputs,
      returns,
      timeout: timeoutValue,
    };
    return Functions.getInstance().create(query);
  }

  async deleteFunction(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id } = call.request.params;
    const func = await Functions.getInstance().findOne({ _id: id });
    if (isNil(func)) {
      throw new GrpcError(status.NOT_FOUND, 'Function does not exist');
    }
    await Functions.getInstance().deleteOne({ _id: id });
    return { deleted: true };
  }

  async listFunctions(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { sort } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    const functions = await Functions.getInstance().findMany({}, skip, limit, sort);
    return { functions };
  }

  async getFunction(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id } = call.request.params;
    const func = await Functions.getInstance().findOne({ _id: id });
    if (isNil(func)) {
      throw new GrpcError(status.NOT_FOUND, 'Function does not exist');
    }
    return { func };
  }

  async updateFunction(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { name, functionCode, inputs, returns, timeout } = call.request.params;
    const func = await Functions.getInstance().findOne({ name: name });
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
    const updated = Functions.getInstance().findByIdAndUpdate(func._id, query);
    return { updated };
  }

  async getFunctionsDefinitions(
    call: ParsedRouterRequest,
  ): Promise<UnparsedRouterResponse> {
    const { sort } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;

    const functionDefinitions = await FunctionDefinitions.getInstance().findMany(
      {},
      skip,
      limit,
      sort,
    );
    return { functionDefinitions };
  }

  async getFunctionDefinitions(
    call: ParsedRouterRequest,
  ): Promise<UnparsedRouterResponse> {
    const { functionName, success } = call.request.params;
    const functionDefinitions = await FunctionDefinitions.getInstance().findMany({
      functionName: functionName,
      success: success,
    });
    if (isNil(functionDefinitions) || isEmpty(functionDefinitions)) {
      throw new GrpcError(status.NOT_FOUND, 'Function Definition does not exist');
    }
    return { functionDefinitions };
  }
}
