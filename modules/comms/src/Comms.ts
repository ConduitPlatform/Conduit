import {
  ConduitGrpcSdk,
  GrpcCallback,
  GrpcRequest,
  HealthCheckStatus,
} from '@conduitplatform/grpc-sdk';
import AppConfigSchema, { Config } from './config/index.js';
import { AdminHandlers } from './admin/index.js';
import path from 'path';
import metricsSchema from './metrics/index.js';
import { ManagedModule, ServiceFunction } from '@conduitplatform/module-tools';
import { fileURLToPath } from 'node:url';
import Sms from './modules/sms/Sms.js';
import { CommService } from './interfaces/CommService.js';
import { ClientRouteHandlers } from './router/index.js';
import { FeatureAvailableRequest, FeatureAvailableResponse } from './protoTypes/comms.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class Comms extends ManagedModule<Config> {
  configSchema = AppConfigSchema;
  protected metricsSchema = metricsSchema;
  private readonly smsService: CommService;
  private readonly emailService: CommService;
  private readonly pushService: CommService;

  constructor() {
    super('sms');
    this.updateHealth(HealthCheckStatus.UNKNOWN, true);
    AdminHandlers.getInstance(this.grpcServer, this.grpcSdk);
    ClientRouteHandlers.getInstance(this.grpcServer, this.grpcSdk);
    this.smsService = Sms.getInstance(this.grpcSdk);
    // this.emailService = Email.getInstance(this.grpcSdk);
    // this.pushService = Sms.getInstance(this.grpcSdk);
    this.service = {
      protoPath: path.resolve(__dirname, 'comms.proto'),
      protoDescription: 'comms',
      functions: {
        Comms: {
          featureAvailable: this.featureAvailable.bind(this),
        },
        Sms: {
          ...(this.smsService.rpcFunctions as { [key: string]: ServiceFunction }),
        },
        Email: {
          ...(this.emailService.rpcFunctions as { [key: string]: ServiceFunction }),
        },
        PushNotifications: {
          ...(this.pushService.rpcFunctions as { [key: string]: ServiceFunction }),
        },
      },
    };
  }

  async preConfig(config: any) {
    let modifiedConfig = config;
    modifiedConfig =
      (await this.smsService.preConfig?.(modifiedConfig)) ?? modifiedConfig;
    modifiedConfig =
      (await this.emailService.preConfig?.(modifiedConfig)) ?? modifiedConfig;
    modifiedConfig =
      (await this.pushService.preConfig?.(modifiedConfig)) ?? modifiedConfig;
    return modifiedConfig;
  }

  async onServerStart() {
    await this.smsService.onServerStart?.();
    await this.emailService.onServerStart?.();
    await this.pushService.onServerStart?.();
  }

  async onConfig() {
    await this.smsService.onConfig?.();
    await this.emailService.onConfig?.();
    await this.pushService.onConfig?.();
    let oneHealthy = false;
    if (this.smsService.health === HealthCheckStatus.SERVING) {
      oneHealthy = true;
    }
    if (this.emailService.health === HealthCheckStatus.SERVING) {
      oneHealthy = true;
    }
    if (this.pushService.health === HealthCheckStatus.SERVING) {
      oneHealthy = true;
    }
    if (oneHealthy) {
      this.updateHealth(HealthCheckStatus.SERVING);
    } else {
      this.updateHealth(HealthCheckStatus.NOT_SERVING);
    }
    await AdminHandlers.getInstance().registerAdminRoutes();

    this.grpcSdk
      .waitForExistence('router')
      .then(() => ClientRouteHandlers.getInstance().registerRoutes())
      .catch(e => {
        ConduitGrpcSdk.Logger.error(e.message);
      });
  }

  async initializeMetrics() {
    await this.smsService.initializeMetrics?.();
    await this.emailService.initializeMetrics?.();
    await this.pushService.initializeMetrics?.();
  }

  // gRPC Service
  async featureAvailable(
    call: GrpcRequest<FeatureAvailableRequest>,
    callback: GrpcCallback<FeatureAvailableResponse>,
  ) {
    const feature = call.request.serviceName;
    let available = false;
    if (feature === 'sms') {
      available = this.smsService.health === HealthCheckStatus.SERVING;
    } else if (feature === 'email') {
      available = this.emailService.health === HealthCheckStatus.SERVING;
    } else if (feature === 'push') {
      available = this.pushService.health === HealthCheckStatus.SERVING;
    }
    callback(null, { available });
  }
}
