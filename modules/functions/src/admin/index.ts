import ConduitGrpcSdk, {
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
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import { FunctionEndpoints } from '../models';

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
          code: ConduitString.Required,
          method: ConduitNumber.Required,
          inputs: { type: [TYPE.JSON], required: true },
          returns: { type: [TYPE.JSON], required: false },
          authentication: { type: TYPE.Boolean, required: false },
          paginated: { type: TYPE.Boolean, required: false },
          sorted: { type: TYPE.Boolean, required: false },
          timeout: ConduitNumber.Optional,
        },
      },
      new ConduitRouteReturnDefinition(FunctionEndpoints.name),
      this.uploadFunction.bind(this),
    );
    this.routingManager.route(
      {
        path: '/function/:id',
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
        path: '/list',
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
        path: '/function/:id',
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
        path: '/function/:id',
        action: ConduitRouteActions.PATCH,
        description: 'Update a function',
        urlParams: {
          id: { type: RouteOptionType.String, required: true },
        },
        bodyParams: {
          name: ConduitString.Required,
          code: ConduitString.Required,
          method: ConduitNumber.Required,
          inputs: { type: [TYPE.JSON], required: true },
          returns: { type: [TYPE.JSON], required: false },
          authentication: { type: TYPE.Boolean, required: false },
          paginated: { type: TYPE.Boolean, required: false },
          sorted: { type: TYPE.Boolean, required: false },
          timeout: ConduitNumber.Optional,
        },
      },
      new ConduitRouteReturnDefinition('UpdateFunction', 'String'),
      this.updateFunction.bind(this),
    );
    this.routingManager.registerRoutes();
  }

  async uploadFunction(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const {
      name,
      code,
      method,
      inputs,
      returns,
      authentication,
      paginated,
      sorted,
      timeout,
    } = call.request.params;
    const func = await FunctionEndpoints.getInstance().findOne({ name: name });
    if (!isNil(func)) {
      throw new GrpcError(status.ALREADY_EXISTS, 'function name already exists');
    }
    const functionReturns = returns ?? {};
    const query = {
      name,
      code,
      method,
      inputs,
      returns: functionReturns,
      authentication,
      paginated,
      sorted,
      timeout,
    };
    const newFunction = await FunctionEndpoints.getInstance().create(query);
    return { newFunction };
  }

  async deleteFunction(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id } = call.request.params;
    const func = await FunctionEndpoints.getInstance().findOne({ _id: id });
    if (isNil(func)) {
      throw new GrpcError(status.NOT_FOUND, 'Function does not exist');
    }
    await FunctionEndpoints.getInstance().deleteOne({ _id: id });
    return { deleted: true };
  }

  async listFunctions(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { sort } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    const functions = await FunctionEndpoints.getInstance().findMany(
      {},
      skip,
      limit,
      sort,
    );
    return { functions };
  }

  async getFunction(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { functionName } = call.request.params;
    const func = await FunctionEndpoints.getInstance().findOne({ name: functionName });
    if (isNil(func)) {
      throw new GrpcError(status.NOT_FOUND, 'Function does not exist');
    }
    return { func };
  }

  async updateFunction(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const {
      name,
      code,
      method,
      inputs,
      returns,
      authentication,
      paginated,
      sorted,
      timeout,
    } = call.request.params;
    const func = await FunctionEndpoints.getInstance().findOne({ name: name });
    if (isNil(func)) {
      throw new GrpcError(status.NOT_FOUND, 'Function does not exist');
    }
    const query = {
      name: name ?? func.name,
      code: code ?? func.code,
      method: method ?? func.method,
      inputs: inputs ?? func.inputs,
      returns: returns ?? func.returns,
      authentication: authentication ?? func.authentication,
      paginated: paginated ?? func.paginated,
      sorted: sorted ?? func.sorted,
      timeout: timeout ?? func.timeout,
    };
    const updated = FunctionEndpoints.getInstance().findByIdAndUpdate(func._id, query);
    return { updated };
  }
}
