import { Trigger } from '../../models/trigger.interface';
import { WebhookInterface } from './webhook.interface';
import ConduitGrpcSdk, {
  ConduitRoute,
  ConduitRouteReturnDefinition,
  constructRoute,
  GrpcServer,
} from '@quintessential-sft/conduit-grpc-sdk';
import grpc from 'grpc';

export class Webhook implements Trigger<WebhookInterface> {
  private static _instance: Webhook;
  private _routes: { [key: string]: ConduitRoute } = {};
  private _routeData: { [key: string]: WebhookInterface } = {};

  private constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    readonly server: GrpcServer
  ) {}

  public static getInstance(grpcSdk: ConduitGrpcSdk, server: GrpcServer) {
    if (!Webhook._instance) {
      Webhook._instance = new Webhook(grpcSdk, server);
    }
    return Webhook._instance;
  }

  async setup(options: WebhookInterface): Promise<boolean> {
    this._routes[options.route] = constructRoute(
      new ConduitRoute(
        {
          path: '/hook/' + options.jobName + options.route,
          action: options.method as any, //just to shut it up really
          middlewares: options.auth ? ['authMiddleware'] : undefined,
        },
        new ConduitRouteReturnDefinition(`${options.jobName}Return`, 'String'),
        'fireWebhook'
      )
    );
    this._routeData[options.route] = options;
    this._refreshRoutes();
    return Promise.resolve(true);
  }

  private fireWebhook(call: any, callback: any) {
    const data = JSON.parse(call.request.params);
    const path = call.request.path;
    let route = Object.keys(this._routeData).filter(
      (route) => path.indexOf(route) !== -1
    );

    if (!route || route.length === 0) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: 'Specified webhook not found',
      });
    } else {
      this._routeData[route[0]].queue.add(data);
    }
  }

  private _refreshRoutes() {
    this.grpcSdk.router
      .registerRouter(this.server, Object.values(this._routes), {
        fireWebhook: this.fireWebhook.bind(this),
      })
      .catch((err: Error) => {
        console.log('Failed to register routes for module');
        console.log(err);
      });
  }
}
