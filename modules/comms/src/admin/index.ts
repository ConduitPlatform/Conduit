import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { GrpcServer, RoutingManager } from '@conduitplatform/module-tools';
import Sms from '../modules/sms/Sms.js';
import Email from '../modules/email/Email.js';
import PushNotifications from '../modules/push/PushNotifications.js';

export class AdminHandlers {
  private readonly routingManager: RoutingManager;
  private static instance: AdminHandlers | null = null;

  private constructor(
    readonly server: GrpcServer,
    readonly grpcSdk: ConduitGrpcSdk,
  ) {
    this.routingManager = new RoutingManager(grpcSdk.admin, server);
  }

  public static getInstance(server?: GrpcServer, grpcSdk?: ConduitGrpcSdk) {
    if (!AdminHandlers.instance) {
      if (!server || !grpcSdk) throw new Error('Server and grpcSdk must be provided');
      AdminHandlers.instance = new AdminHandlers(server!, grpcSdk!);
    }
    return AdminHandlers.instance;
  }

  async registerAdminRoutes() {
    this.routingManager.clear();
    await Sms.getInstance().registerAdminRoutes(this.routingManager);
    await Email.getInstance().registerAdminRoutes(this.routingManager);
    await PushNotifications.getInstance().registerAdminRoutes(this.routingManager);
    await this.routingManager.registerRoutes();
  }
}
