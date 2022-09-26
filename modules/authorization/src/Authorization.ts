import ConduitGrpcSdk, {
  ManagedModule,
  ConfigController,
  DatabaseProvider,
  HealthCheckStatus,
  GrpcRequest,
  GrpcResponse,
} from '@conduitplatform/grpc-sdk';
import path from 'path';
import AppConfigSchema, { Config } from './config';
import * as models from './models';
// import { AdminHandlers } from './admin';
import { runMigrations } from './migrations';
import metricsConfig from './metrics';
import {
  Decision,
  Empty,
  PermissionCheck,
  Relation,
  Resource,
} from './protoTypes/authorization';
import { IndexController } from './controllers/index.controller';
import { PermissionsController } from './controllers/permissions.controller';
import { RelationsController } from './controllers/relations.controller';
import { ResourceController } from './controllers/resource.controller';

export default class Authorization extends ManagedModule<Config> {
  configSchema = AppConfigSchema;
  service = {
    protoPath: path.resolve(__dirname, 'authorization.proto'),
    protoDescription: 'authorization.Authorization',
    functions: {
      setConfig: this.setConfig.bind(this),
      defineResource: this.defineResource.bind(this),
      createRelation: this.createRelation.bind(this),
      findRelation: this.findRelation.bind(this),
      can: this.can.bind(this),
    },
  };
  // private adminRouter: AdminHandlers;
  private indexController: IndexController;
  private permissionsController: PermissionsController;
  private relationsController: RelationsController;
  private resourceController: ResourceController;
  // private userRouter: AuthenticationRoutes;
  private database: DatabaseProvider;

  constructor() {
    super('authorization');
    this.updateHealth(HealthCheckStatus.UNKNOWN, true);
  }

  async onServerStart() {
    await this.grpcSdk.waitForExistence('database');
    this.database = this.grpcSdk.database!;
    await runMigrations(this.grpcSdk);
    await this.grpcSdk.monitorModule('authentication', serving => {
      this.updateHealth(
        serving ? HealthCheckStatus.SERVING : HealthCheckStatus.NOT_SERVING,
      );
    });
  }

  protected registerSchemas() {
    const promises = Object.values(models).map(model => {
      const modelInstance = model.getInstance(this.database);
      return this.database.createSchemaFromAdapter(modelInstance);
    });
    return Promise.all(promises);
  }

  async onConfig() {
    const config = ConfigController.getInstance().config;
    if (!config.active) {
      this.updateHealth(HealthCheckStatus.NOT_SERVING);
    } else {
      await this.registerSchemas();
      this.resourceController = ResourceController.getInstance(this.grpcSdk);
      this.indexController = IndexController.getInstance(this.grpcSdk);
      this.relationsController = RelationsController.getInstance(this.grpcSdk);
      this.permissionsController = PermissionsController.getInstance(this.grpcSdk);
      // this.adminRouter = new AdminHandlers(this.grpcServer, this.grpcSdk);
      await this.refreshAppRoutes();
      this.updateHealth(HealthCheckStatus.SERVING);
    }
  }

  async defineResource(call: GrpcRequest<Resource>, callback: GrpcResponse<Empty>) {
    const { name, relations, permissions } = call.request;
    let resource: {
      name: string;
      relations?: { [key: string]: string | string[] };
      permissions?: { [key: string]: string | string[] };
    } = {
      name,
    };
    resource.relations = {};
    relations.forEach(relation => {
      resource.relations![relation.name] = relation.resourceType;
    });
    resource.permissions = {};
    permissions.forEach(permission => {
      resource.permissions![permission.name] = permission.roles;
    });
    await this.resourceController.createResource(resource);
    callback(null, {});
  }

  async createRelation(call: GrpcRequest<Relation>, callback: GrpcResponse<Empty>) {
    const { relation, resource, subject } = call.request;
    await this.relationsController.createRelation(subject, relation, resource);
    callback(null, {});
  }

  findRelation() {}

  can(call: GrpcRequest<PermissionCheck>, callback: GrpcResponse<Decision>) {
    const { subject, resource, action } = call.request;
    this.permissionsController
      .can(subject, action, resource)
      .then(allow => {
        callback(null, { allow });
      })
      .catch(e => {
        callback(e);
      });
  }

  initializeMetrics() {
    for (const metric of Object.values(metricsConfig)) {
      this.grpcSdk.registerMetric(metric.type, metric.config);
    }
  }

  private async refreshAppRoutes() {
    // if (this.userRouter) {
    //   this.userRouter.updateLocalHandlers(this.localSendVerificationEmail);
    //   this.scheduleAppRouteRefresh();
    //   return;
    // }
    // const self = this;
    // this.grpcSdk
    //   .waitForExistence('router')
    //   .then(() => {
    //     self.userRouter = new AuthenticationRoutes(
    //       self.grpcServer,
    //       self.grpcSdk,
    //       self.localSendVerificationEmail,
    //     );
    //     this.scheduleAppRouteRefresh();
    //   })
    //   .catch(e => {
    //     ConduitGrpcSdk.Logger.error(e.message);
    //   });
  }

  private scheduleAppRouteRefresh() {
    // if (this.refreshAppRoutesTimeout) {
    //   clearTimeout(this.refreshAppRoutesTimeout);
    //   this.refreshAppRoutesTimeout = null;
    // }
    // this.refreshAppRoutesTimeout = setTimeout(async () => {
    //   try {
    //     await this.userRouter.registerRoutes();
    //   } catch (err) {
    //     ConduitGrpcSdk.Logger.error(err as Error);
    //   }
    //   this.refreshAppRoutesTimeout = null;
    // }, 800);
  }
}
