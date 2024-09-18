import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { GrpcServer, RoutingManager } from '@conduitplatform/module-tools';
import Sms from '../modules/sms/Sms.js';
import { CommService } from '../interfaces/CommService.js';
import Email from '../modules/email/Email.js';
import PushNotifications from '../modules/push/PushNotifications.js';

export class ClientRouteHandlers {
  private readonly routingManager: RoutingManager;
  private static instance: ClientRouteHandlers | null = null;

  private constructor(
    readonly server: GrpcServer,
    readonly grpcSdk: ConduitGrpcSdk,
  ) {
    this.routingManager = new RoutingManager(grpcSdk.router!, server);
  }

  public static getInstance(server?: GrpcServer, grpcSdk?: ConduitGrpcSdk) {
    if (!ClientRouteHandlers.instance) {
      if (!server || !grpcSdk) throw new Error('Server and grpcSdk must be provided');
      ClientRouteHandlers.instance = new ClientRouteHandlers(server!, grpcSdk!);
    }
    return ClientRouteHandlers.instance;
  }

  async registerRoutes() {
    this.routingManager.clear();
    await (Sms.getInstance() as CommService).registerRoutes?.(this.routingManager);
    await (Email.getInstance() as CommService).registerAdminRoutes?.(this.routingManager);
    await (PushNotifications.getInstance() as CommService).registerAdminRoutes?.(
      this.routingManager,
    );

    await this.routingManager.registerRoutes();
  }
}
