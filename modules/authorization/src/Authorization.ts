import ConduitGrpcSdk, {
  DatabaseProvider,
  GrpcRequest,
  GrpcResponse,
  HealthCheckStatus,
} from '@conduitplatform/grpc-sdk';
import path from 'path';
import AppConfigSchema, { Config } from './config';
import * as models from './models';
import { runMigrations } from './migrations';
import metricsSchema from './metrics';
import {
  Decision,
  DeleteResourceRequest,
  Empty,
  FindRelationRequest,
  PermissionCheck,
  PermissionRequest,
  Relation,
  Resource,
  Resource_Permission,
  Resource_Relation,
} from './protoTypes/authorization';
import { IndexController } from './controllers/index.controller';
import { PermissionsController } from './controllers/permissions.controller';
import { RelationsController } from './controllers/relations.controller';
import { ResourceController } from './controllers/resource.controller';
import { AdminHandlers } from './admin';
import { status } from '@grpc/grpc-js';
import { ConfigController, ManagedModule } from '@conduitplatform/module-tools';

export default class Authorization extends ManagedModule<Config> {
  configSchema = AppConfigSchema;
  service = {
    protoPath: path.resolve(__dirname, 'authorization.proto'),
    protoDescription: 'authorization.Authorization',
    functions: {
      setConfig: this.setConfig.bind(this),
      defineResource: this.defineResource.bind(this),
      deleteResource: this.deleteResource.bind(this),
      updateResource: this.updateResource.bind(this),
      createRelation: this.createRelation.bind(this),
      grantPermission: this.grantPermission.bind(this),
      removePermission: this.removePermission.bind(this),
      deleteRelation: this.deleteRelation.bind(this),
      deleteAllRelations: this.deleteAllRelations.bind(this),
      findRelation: this.findRelation.bind(this),
      can: this.can.bind(this),
    },
  };
  protected metricsSchema = metricsSchema;
  private adminRouter: AdminHandlers;
  private indexController: IndexController;
  private permissionsController: PermissionsController;
  private relationsController: RelationsController;
  private resourceController: ResourceController;
  private database: DatabaseProvider;

  constructor() {
    super('authorization');
    this.updateHealth(HealthCheckStatus.UNKNOWN, true);
  }

  async onServerStart() {
    await this.grpcSdk.waitForExistence('database');
    this.database = this.grpcSdk.database!;
    await runMigrations(this.grpcSdk);
  }

  async onConfig() {
    const config = ConfigController.getInstance().config;
    if (!config.active) {
      this.updateHealth(HealthCheckStatus.NOT_SERVING);
    } else {
      await this.registerSchemas();
      this.indexController = IndexController.getInstance(this.grpcSdk);
      this.relationsController = RelationsController.getInstance(
        this.grpcSdk,
        this.indexController,
      );
      this.indexController.relationsController = this.relationsController;
      this.permissionsController = PermissionsController.getInstance(this.grpcSdk);
      this.resourceController = ResourceController.getInstance(this.grpcSdk);
      this.adminRouter = new AdminHandlers(this.grpcServer, this.grpcSdk);
      this.updateHealth(HealthCheckStatus.SERVING);
    }
  }

  async defineResource(call: GrpcRequest<Resource>, callback: GrpcResponse<null>) {
    const { name, relations, permissions } = call.request;
    const resource = this.createResourceObject(name, relations, permissions);
    await this.resourceController.createResource(resource);
    ConduitGrpcSdk.Logger.info(`Resource ${name} created`);
    callback(null, null);
  }

  async updateResource(call: GrpcRequest<Resource>, callback: GrpcResponse<Empty>) {
    const { name, relations, permissions } = call.request;
    const resource = this.createResourceObject(name, relations, permissions);
    await this.resourceController.updateResourceDefinition(resource.name, resource);
    callback(null, undefined);
  }

  async deleteResource(
    call: GrpcRequest<DeleteResourceRequest>,
    callback: GrpcResponse<Empty>,
  ) {
    const { name } = call.request;
    await this.resourceController.deleteResource(name);
    callback(null, {});
  }

  async createRelation(call: GrpcRequest<Relation>, callback: GrpcResponse<Empty>) {
    const { relation, resource, subject } = call.request;
    await this.relationsController.createRelation(subject, relation, resource);
    callback(null, {});
  }

  async deleteRelation(call: GrpcRequest<Relation>, callback: GrpcResponse<Empty>) {
    const { relation, resource, subject } = call.request;
    await this.relationsController.deleteRelation(subject, relation, resource);
    callback(null, {});
  }

  async deleteAllRelations(call: GrpcRequest<Relation>, callback: GrpcResponse<Empty>) {
    const { resource, subject } = call.request;
    try {
      await this.relationsController.deleteAllRelations({ subject, resource });
    } catch (e) {
      ConduitGrpcSdk.Logger.warn((e as Error).message);
    } finally {
      callback(null, {});
    }
  }

  async findRelation(
    call: GrpcRequest<FindRelationRequest>,
    callback: GrpcResponse<Empty>,
  ) {
    const { relation, resource, subject, resourceType, subjectType, skip, limit } =
      call.request;
    if (!subject && !relation && !resource) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'At least 2 of subject, relation, resource must be provided',
      });
    }
    const [relations, count] = await this.relationsController.findRelations(
      {
        relation,
        resource,
        subject,
        resourceType,
        subjectType,
      },
      skip,
      limit,
    );
    callback(null, { relations, count });
  }

  async can(call: GrpcRequest<PermissionCheck>, callback: GrpcResponse<Decision>) {
    const { subject, resource, actions } = call.request;
    let allow = false;
    for (const action of actions) {
      allow = await this.permissionsController.can(subject, action, resource);
      if (allow) break;
    }
    callback(null, { allow });
  }

  async grantPermission(
    call: GrpcRequest<PermissionRequest>,
    callback: GrpcResponse<Decision>,
  ) {
    const { subject, resource, action } = call.request;
    await this.permissionsController.grantPermission(subject, action, resource);
    callback(null);
  }

  async removePermission(
    call: GrpcRequest<PermissionRequest>,
    callback: GrpcResponse<Decision>,
  ) {
    const { subject, resource, action } = call.request;
    await this.permissionsController.removePermission(subject, action, resource);

    callback(null);
  }

  async initializeMetrics() {
    // for (const metric of Object.values(metricsConfig)) {
    //   this.grpcSdk.registerMetric(metric.type, metric.config);
    // }
  }

  createResourceObject(
    name: string,
    relations: Resource_Relation[],
    permissions: Resource_Permission[],
  ) {
    const resource: {
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
    return resource;
  }

  protected registerSchemas() {
    const promises = Object.values(models).map(model => {
      const modelInstance = model.getInstance(this.database);
      return this.database
        .createSchemaFromAdapter(modelInstance)
        .then(() => this.database.migrate(modelInstance.name));
    });
    return Promise.all(promises);
  }
}
