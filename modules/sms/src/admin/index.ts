import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { ConduitString, GrpcServer, RoutingManager } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash-es';
import { ISmsProvider } from '../interfaces/ISmsProvider.js';

export class AdminHandlers {
  private provider: ISmsProvider | undefined;
  private readonly routingManager: RoutingManager;

  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    provider: ISmsProvider | undefined,
  ) {
    this.provider = provider;
    this.routingManager = new RoutingManager(this.grpcSdk.admin, this.server);
    this.registerAdminRoutes();
  }

  updateProvider(provider: ISmsProvider) {
    this.provider = provider;
  }

  async sendSms(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { to, message } = call.request.params;
    let errorMessage: string | null = null;

    if (isNil(this.provider)) {
      throw new GrpcError(status.INTERNAL, 'No SMS provider');
    }

    await this.provider.sendSms(to, message).catch(e => (errorMessage = e.message));
    if (!isNil(errorMessage)) {
      throw new GrpcError(status.INTERNAL, errorMessage);
    }
    ConduitGrpcSdk.Metrics?.increment('sms_sent_total');
    return 'SMS sent';
  }

  private registerAdminRoutes() {
    this.routingManager.clear();
    this.routingManager.route(
      {
        path: '/send',
        action: ConduitRouteActions.POST,
        description: `Sends sms.`,
        bodyParams: {
          to: ConduitString.Required,
          message: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition('SendSMS', 'String'),
      this.sendSms.bind(this),
    );
    this.routingManager.registerRoutes();
  }
}
