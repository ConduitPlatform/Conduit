import ConduitGrpcSdk, {
  GrpcServer,
  constructConduitRoute,
  ParsedRouterRequest,
  UnparsedRouterResponse,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
  ConduitString,
  ConduitRouteObject,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash';
import { ISmsProvider } from '../interfaces/ISmsProvider';

export class AdminHandlers {
  private provider: ISmsProvider | undefined;

  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    provider: ISmsProvider | undefined,
  ) {
    this.provider = provider;
    this.registerAdminRoutes();
  }

  updateProvider(provider: ISmsProvider) {
    this.provider = provider;
  }

  private registerAdminRoutes() {
    const paths = this.getRegisteredRoutes();
    this.grpcSdk.admin
      .registerAdminAsync(this.server, paths, {
        sendSms: this.sendSms.bind(this),
      })
      .catch((err: Error) => {
        ConduitGrpcSdk.Logger.error('Failed to register admin routes for module!');
        ConduitGrpcSdk.Logger.error(err);
      });
  }

  private getRegisteredRoutes(): ConduitRouteObject[] {
    return [
      constructConduitRoute(
        {
          path: '/send',
          action: ConduitRouteActions.POST,
          description: `Sends sms requiring text message and receiver's number.`,
          bodyParams: {
            to: ConduitString.Required,
            message: ConduitString.Required,
          },
        },
        new ConduitRouteReturnDefinition('SendSMS', 'String'),
        'sendSms',
      ),
    ];
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
}
