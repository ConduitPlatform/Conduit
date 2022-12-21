import ConduitGrpcSdk, {
  ConfigController,
  DatabaseProvider,
  GrpcRequest,
  GrpcCallback,
  HealthCheckStatus,
  ManagedModule,
} from '@conduitplatform/grpc-sdk';
import { Config } from './config';
import AppConfigSchema from '@conduitplatform/email/dist/config';
import metricsSchema from './metrics';
import path from 'path';
import { AdminHandlers } from './admin';
import { runMigrations } from './migrations';
import { isNil } from 'lodash';
import * as models from './models';
import { ExecuteFunctionRequest } from './protoTypes/functions';
import { status } from '@grpc/grpc-js';
import { NodeVM } from 'vm2';

export default class Functions extends ManagedModule<Config> {
  configSchema = AppConfigSchema;
  protected metricsSchema = metricsSchema;

  service = {
    protoPath: path.resolve(__dirname, 'functions.proto'),
    protoDescription: 'functions.Functions',
    functions: {
      setConfig: this.setConfig.bind(this),
      executeFunction: this.executeFunction.bind(this),
    },
  };

  private adminRouter: AdminHandlers;
  private database: DatabaseProvider;

  constructor() {
    super('functions');
    this.updateHealth(HealthCheckStatus.UNKNOWN, true);
  }

  async onServerStart() {
    await this.grpcSdk.waitForExistence('database');
    this.database = this.grpcSdk.database!;
    await this.registerSchemas();
    await runMigrations(this.grpcSdk);
  }

  protected registerSchemas() {
    const promises = Object.values(models).map(model => {
      const modelInstance = model.getInstance(this.database);
      return this.database.createSchemaFromAdapter(modelInstance);
    });
    return Promise.all(promises);
  }

  async onConfig() {
    if (!ConfigController.getInstance().config.active) {
      this.updateHealth(HealthCheckStatus.NOT_SERVING);
    }
    this.adminRouter = new AdminHandlers(this.grpcServer, this.grpcSdk);
    this.updateHealth(HealthCheckStatus.SERVING);
  }

  async executeFunction(
    call: GrpcRequest<ExecuteFunctionRequest>,
    callback: GrpcCallback<null>,
  ) {
    const { name } = call.request;
    let errorMessage: string | null = null;
    if (isNil(name)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Invalid request',
      });
    }
    const functionModel = await models.Functions.getInstance()
      .findOne({ name })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    if (isNil(functionModel)) {
      return callback({ code: status.NOT_FOUND, message: 'Function not found' });
    }

    // @ts-ignore
    const { code } = functionModel;

    const vm = new NodeVM({
      console: 'inherit',
      sandbox: {},
    });
    const result = vm.run(code);
    ConduitGrpcSdk.Metrics?.increment('executed_functions_total', 1);
    return callback(null, result);
  }
}
