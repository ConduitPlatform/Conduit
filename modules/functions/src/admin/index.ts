import ConduitGrpcSdk, {
  GrpcServer,
  ParsedRouterRequest,
  RoutingManager,
} from '@conduitplatform/grpc-sdk';
import * as vm from 'vm';

export const Operations = {
  GET: 0,
  POST: 1,
  PUT: 2,
  DELETE: 3,
  PATCH: 4,
};

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
    this.routingManager.registerRoutes();
  }

  async uploadFunction(call: ParsedRouterRequest) {
    const { functionName, functionCode, operation } = call.request.params;
    // const context = vm.createContext();
  }

  async executeFunction(call: ParsedRouterRequest) {}

  async deleteFunction(call: ParsedRouterRequest) {}

  async listFunctions(call: ParsedRouterRequest) {}

  async getFunction(call: ParsedRouterRequest) {}

  async updateFunction(call: ParsedRouterRequest) {}
}
