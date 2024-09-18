import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { ConduitString, RoutingManager } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash-es';
import { ISmsProvider } from '../interfaces/ISmsProvider.js';

export class AdminHandlers {
  private provider: ISmsProvider | undefined;

  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    provider: ISmsProvider | undefined,
  ) {
    this.provider = provider;
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

  registerAdminRoutes(routingManager: RoutingManager) {
    routingManager.route(
      {
        path: '/sms/send',
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
  }
}
