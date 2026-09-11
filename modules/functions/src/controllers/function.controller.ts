import {
  ConduitGrpcSdk,
  ConduitMiddlewareOptions,
  ConduitRouteOptions,
  ConduitRouteReturnDefinition,
  ConduitSocketOptions,
} from '@conduitplatform/grpc-sdk';
import {
  ConfigController,
  GrpcServer,
  RequestHandlers,
  RoutingManager,
  SocketEventHandler,
} from '@conduitplatform/module-tools';

import { Functions } from '../models/index.js';
import { CronQueueController } from './cronQueue.controller.js';
import { createFunctionRoute, tryPrepareCronFunction } from './utils.js';
import type { CompiledUserFunction } from '../sandbox/functionSandbox.js';

type Socket = {
  input: ConduitSocketOptions;
  events: Record<string, SocketEventHandler>;
};
type Route = {
  input: ConduitRouteOptions;
  type: ConduitRouteReturnDefinition;
  handler: RequestHandlers;
  returnType: ConduitRouteReturnDefinition;
};
type Middleware = {
  input: ConduitMiddlewareOptions;
  handler: RequestHandlers;
};

type FunctionRoute = Route | Socket | Middleware;

export class FunctionController {
  private functionRoutes: FunctionRoute[] = [];
  private readonly compiledCronFunctions = new Map<string, CompiledUserFunction>();

  private _routingManager: RoutingManager;

  constructor(
    readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
  ) {
    this._routingManager = new RoutingManager(this.grpcSdk.router!, server);
    this.refreshRoutes();
    this.initializeState();
  }

  initializeState() {
    this.grpcSdk.bus?.subscribe('functions', () => {
      this.refreshRoutes();
    });
  }

  async refreshRoutes() {
    try {
      const functions = await Functions.getInstance().findMany(
        {},
        { readPreference: 'primary' },
      );
      if (!functions || functions.length === 0) {
        ConduitGrpcSdk.Logger.log('No functions to register');
      }
      this.functionRoutes = [];
      this.compiledCronFunctions.clear();

      for (const func of functions) {
        try {
          if (func.functionType === 'cron') {
            this.compiledCronFunctions.set(func._id, tryPrepareCronFunction(func));
            continue;
          }
          const route = createFunctionRoute(func, this.grpcSdk);
          if (route) {
            this.functionRoutes.push(route as FunctionRoute);
          }
        } catch (err) {
          ConduitGrpcSdk.Logger.error(
            `Failed to process function ${func.name} (${func._id}); skipping`,
          );
          ConduitGrpcSdk.Logger.error(err as Error);
        }
      }
      this._routingManager.clear();
      this.functionRoutes.forEach(route => {
        if ((route as Socket).events) {
          this._routingManager.socket((route as Socket).input, (route as Socket).events);
        } else if (!(route as Middleware).hasOwnProperty('returnType')) {
          this._routingManager.middleware(
            (route as Middleware).input,
            (route as Middleware).handler,
          );
        } else {
          this._routingManager.route(
            (route as Route).input,
            (route as Route).returnType,
            (route as Route).handler,
          );
        }
      });
      await this._routingManager.registerRoutes();
      ConduitGrpcSdk.Logger.log('Refreshed routes');

      if (ConfigController.getInstance().config.active) {
        const cronQueue = CronQueueController.getInstance(this.grpcSdk);
        cronQueue.setCompiledFunctions(this.compiledCronFunctions);
        await cronQueue.syncCronJobs();
      }
    } catch (err) {
      ConduitGrpcSdk.Logger.error(
        'Something went wrong when loading functions to the router',
      );
      ConduitGrpcSdk.Logger.error(err as Error);
    }
  }

  refreshEndpoints(): void {
    this.grpcSdk.bus?.publish('functions', '');
    this.refreshRoutes();
  }
}
