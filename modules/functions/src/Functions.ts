import {
  ConduitGrpcSdk,
  DatabaseProvider,
  HealthCheckStatus,
} from '@conduitplatform/grpc-sdk';
import metricsSchema from './metrics/index.js';
import { AdminHandlers } from './admin/index.js';
import * as models from './models/index.js';
import AppConfigSchema, { Config } from './config/index.js';
import { FunctionController } from './controllers/function.controller.js';
import {
  ConfigController,
  ManagedModule,
  sanitizeDocumentsForExport,
  type ExportableResource,
  type ExportResult,
  type ImportResult,
} from '@conduitplatform/module-tools';

export default class Functions extends ManagedModule<Config> {
  configSchema = AppConfigSchema;
  protected metricsSchema = metricsSchema;
  private isRunning: boolean = false;
  private adminRouter: AdminHandlers;

  private functionsController: FunctionController;
  private database: DatabaseProvider;

  constructor() {
    super('functions');
    this.updateHealth(HealthCheckStatus.UNKNOWN, true);
  }

  async onServerStart() {
    await this.grpcSdk.waitForExistence('database');
    this.database = this.grpcSdk.database!;
    await this.registerSchemas();
  }

  async onConfig() {
    if (!ConfigController.getInstance().config.active) {
      this.updateHealth(HealthCheckStatus.NOT_SERVING);
    }
    if (!this.isRunning) {
      this.grpcSdk
        .waitForExistence('router')
        .then(() => {
          this.isRunning = true;
          this.functionsController = new FunctionController(
            this.grpcServer,
            this.grpcSdk,
          );
          this.adminRouter = new AdminHandlers(
            this.grpcServer,
            this.grpcSdk,
            this.functionsController,
          );
          return this.functionsController.refreshRoutes();
        })
        .catch(e => {
          ConduitGrpcSdk.Logger.error(e.message);
        });
    }
    this.updateHealth(HealthCheckStatus.SERVING);
  }

  protected registerSchemas(): Promise<unknown> {
    const promises = Object.values(models).map(model => {
      const modelInstance = model.getInstance(this.database);
      return this.database
        .createSchemaFromAdapter(modelInstance)
        .then(() => this.database.migrate(modelInstance.name));
    });
    return Promise.all(promises);
  }

  // Framework export/import (GitOps)
  protected getExportableResources(): ExportableResource[] {
    return [{ type: 'functions', description: 'Function definitions', priority: 40 }];
  }

  protected async exportResources(resourceTypes?: string[]): Promise<ExportResult> {
    if (!this.database) return {};
    if (resourceTypes && resourceTypes.length > 0 && !resourceTypes.includes('functions'))
      return {};
    const docs = await models.Functions.getInstance(this.database).findMany({});
    return {
      functions: sanitizeDocumentsForExport(docs as Record<string, unknown>[]),
    };
  }

  protected async importResources(data: ExportResult): Promise<ImportResult> {
    if (!this.database) return {};
    const result: ImportResult = {
      functions: { created: 0, updated: 0, failed: 0, errors: [] },
    };
    const model = models.Functions.getInstance(this.database);
    for (const rec of data.functions ?? []) {
      const r = rec as Record<string, unknown>;
      const name = r.name;
      if (name == null || name === '') {
        result.functions.failed += 1;
        result.functions.errors.push('Missing name');
        continue;
      }
      try {
        const existing = await model.findOne({ name });
        if (existing) {
          await model.updateOne({ name }, r);
          result.functions.updated += 1;
        } else {
          await model.create(r);
          result.functions.created += 1;
        }
      } catch (e) {
        result.functions.failed += 1;
        result.functions.errors.push(`${String(name)}: ${(e as Error).message}`);
      }
    }
    if (
      result.functions.created + result.functions.updated > 0 &&
      this.functionsController
    ) {
      await this.functionsController.refreshRoutes();
    }
    return result;
  }
}
