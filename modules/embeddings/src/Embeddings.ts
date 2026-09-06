import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ConduitGrpcSdk,
  DatabaseProvider,
  GrpcRequest,
  GrpcResponse,
  HealthCheckStatus,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import {
  ConfigController,
  ConduitActiveSchema,
  ManagedModule,
} from '@conduitplatform/module-tools';
import AppConfigSchema, { Config } from './config/index.js';
import * as models from './models/index.js';
import { EmbeddingConfig } from './models/index.js';
import { QueueController } from './controllers/queue.controller.js';
import { getProvider, hashEmbeddingInput } from './providers/index.js';
import { validateEmbeddingConfigInput } from './utils/validateEmbeddingConfig.js';
import metricsSchema from './metrics/index.js';
import {
  BackfillRequest,
  EmbeddingConfigRequest,
  EmbeddingConfigResponse,
  EmbeddingsQueryResponse,
  SemanticSearchRequest,
} from './protoTypes/embeddings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class EmbeddingsModule extends ManagedModule<Config> {
  configSchema = AppConfigSchema;
  protected metricsSchema = metricsSchema;
  service = {
    protoPath: path.resolve(__dirname, 'embeddings.proto'),
    protoDescription: 'embeddings.EmbeddingsProvider',
    functions: {
      upsertConfig: this.upsertConfig.bind(this),
      getConfigs: this.getConfigs.bind(this),
      startBackfill: this.startBackfill.bind(this),
      semanticSearch: this.semanticSearch.bind(this),
    },
  };

  private database: DatabaseProvider;
  private queueController: QueueController;
  private subscribedSchemas = new Set<string>();

  constructor(peerManifestRoot?: string) {
    super('embeddings', peerManifestRoot);
    this.updateHealth(HealthCheckStatus.UNKNOWN, true);
  }

  async onServerStart() {
    await this.awaitPeersFromManifest();
    this.database = this.grpcSdk.database!;
    await this.registerSchemas();
    this.queueController = QueueController.getInstance(this.grpcSdk);
    await this.configureRuntime();
    this.updateHealth(HealthCheckStatus.SERVING);
  }

  async onConfig() {
    if (!this.database) return;
    await this.configureRuntime();
  }

  async upsertConfig(
    call: GrpcRequest<EmbeddingConfigRequest>,
    callback: GrpcResponse<EmbeddingConfigResponse>,
  ) {
    try {
      const config = this.validateConfigRequest(call.request);
      const schema = await this.database.getSchema(config.schemaName);
      if (!config.sourceFields.every(field => schema.fields[field])) {
        return callback({
          code: 3,
          message: 'All source fields must exist on the target schema',
        });
      }
      await this.database.setSchemaExtension({
        schemaName: config.schemaName,
        fields: {
          [config.targetField]: {
            type: TYPE.Vector,
            dimensions: config.dimensions,
            similarity: config.similarity,
            select: false,
          },
          [`${config.targetField}SourceHash`]: {
            type: TYPE.String,
            required: false,
            select: false,
          },
        },
      });
      const model = EmbeddingConfig.getInstance();
      const existing = await model.findOne({
        schemaName: config.schemaName,
        targetField: config.targetField,
      });
      if (existing) {
        await model.findByIdAndUpdate(existing._id, config);
      } else {
        await model.create({ ...config, enabled: true });
      }
      this.subscribeToSchema(config.schemaName);
      callback(null, { result: 'Embedding config saved' });
    } catch (err) {
      callback({ code: 13, message: (err as Error).message });
    }
  }

  async getConfigs(
    _call: GrpcRequest<unknown>,
    callback: GrpcResponse<EmbeddingsQueryResponse>,
  ) {
    try {
      const configs = await EmbeddingConfig.getInstance().findMany({});
      callback(null, { result: JSON.stringify(configs) });
    } catch (err) {
      callback({ code: 13, message: (err as Error).message });
    }
  }

  async startBackfill(
    call: GrpcRequest<BackfillRequest>,
    callback: GrpcResponse<EmbeddingsQueryResponse>,
  ) {
    try {
      const configs = await EmbeddingConfig.getInstance().findMany({
        schemaName: call.request.schemaName,
        enabled: true,
      });
      const batchSize = call.request.batchSize ?? 100;
      const docs = await this.database.findMany<Record<string, unknown>>(
        call.request.schemaName,
        {},
        { limit: batchSize, select: '_id' },
      );
      const attempts = this.currentConfig().queue.attempts;
      await this.queueController.addBulkEmbeddingJobs(
        docs.flatMap(doc =>
          configs.map(config => ({
            schemaName: config.schemaName,
            documentId: String(doc._id),
            configId: config._id,
          })),
        ),
        attempts,
      );
      callback(null, {
        result: JSON.stringify({ queued: docs.length * configs.length }),
      });
    } catch (err) {
      callback({ code: 13, message: (err as Error).message });
    }
  }

  async semanticSearch(
    call: GrpcRequest<SemanticSearchRequest>,
    callback: GrpcResponse<EmbeddingsQueryResponse>,
  ) {
    try {
      const config = await this.resolveConfig(
        call.request.schemaName,
        call.request.targetField,
      );
      const providerConfig = this.providerConfig(config.provider, config.modelName);
      const vector = await getProvider(config.provider).embed(
        call.request.text,
        providerConfig,
      );
      if (vector.length !== config.dimensions) {
        throw new Error(
          `Embedding provider returned ${vector.length} dimensions; expected ${config.dimensions}`,
        );
      }
      const results = await this.database.vectorSearch({
        schemaName: call.request.schemaName,
        field: config.targetField,
        vector,
        filter: call.request.filter ? JSON.parse(call.request.filter) : undefined,
        limit: call.request.limit,
        userId: call.request.userId,
        scope: call.request.scope,
      });
      callback(null, { result: JSON.stringify(results) });
    } catch (err) {
      callback({ code: 13, message: (err as Error).message });
    }
  }

  private async configureRuntime() {
    const config = this.currentConfig();
    if (!config.enabled) return;
    this.queueController ??= QueueController.getInstance(this.grpcSdk);
    this.queueController.addWorker(
      data => this.processEmbeddingJob(data.schemaName, data.documentId, data.configId),
      config.queue.concurrency,
    );
    const configs = await EmbeddingConfig.getInstance().findMany({ enabled: true });
    configs.forEach(config => this.subscribeToSchema(config.schemaName));
  }

  private subscribeToSchema(schemaName: string) {
    if (this.subscribedSchemas.has(schemaName)) return;
    this.subscribedSchemas.add(schemaName);
    const idPrefix = `embeddings:${schemaName}`;
    this.grpcSdk.bus?.subscribe(
      `database:create:${schemaName}`,
      message => this.enqueueMutation(schemaName, message),
      `${idPrefix}:create`,
    );
    this.grpcSdk.bus?.subscribe(
      `database:update:${schemaName}`,
      message => this.enqueueMutation(schemaName, message),
      `${idPrefix}:update`,
    );
    this.grpcSdk.bus?.subscribe(
      `database:createMany:${schemaName}`,
      message => this.enqueueMutation(schemaName, message),
      `${idPrefix}:createMany`,
    );
    this.grpcSdk.bus?.subscribe(
      `database:updateMany:${schemaName}`,
      message => this.enqueueMutation(schemaName, message),
      `${idPrefix}:updateMany`,
    );
  }

  private enqueueMutation(schemaName: string, message: string) {
    const attempts = this.currentConfig().queue.attempts;
    const payload = JSON.parse(message);
    const docs = Array.isArray(payload) ? payload : [payload];
    docs
      .filter(doc => doc?._id)
      .forEach(doc => {
        this.queueController
          .addEmbeddingJob({ schemaName, documentId: String(doc._id) }, attempts)
          .catch(err => ConduitGrpcSdk.Logger.error(err));
      });
  }

  private async processEmbeddingJob(
    schemaName: string,
    documentId: string,
    configId?: string,
  ) {
    const configs = configId
      ? [await EmbeddingConfig.getInstance().findOne({ _id: configId })]
      : await EmbeddingConfig.getInstance().findMany({ schemaName, enabled: true });
    const doc = await this.database.findOne<Record<string, unknown>>(schemaName, {
      _id: documentId,
    });
    if (!doc) return;
    for (const config of configs.filter(Boolean) as EmbeddingConfig[]) {
      const input = config.sourceFields.map(field => doc[field] ?? '').join('\n');
      const sourceHash = hashEmbeddingInput(input);
      if (doc[`${config.targetField}SourceHash`] === sourceHash) continue;
      const vector = await getProvider(config.provider).embed(
        input,
        this.providerConfig(config.provider, config.modelName),
      );
      if (vector.length !== config.dimensions) {
        throw new Error(
          `Embedding provider returned ${vector.length} dimensions; expected ${config.dimensions}`,
        );
      }
      await this.database.findByIdAndUpdate(schemaName, documentId, {
        [config.targetField]: vector,
        [`${config.targetField}SourceHash`]: sourceHash,
      });
    }
  }

  private validateConfigRequest(request: EmbeddingConfigRequest) {
    return validateEmbeddingConfigInput(request, {
      provider: this.currentConfig().defaultProvider,
    });
  }

  private async resolveConfig(schemaName: string, targetField?: string) {
    const query: Record<string, unknown> = { schemaName, enabled: true };
    if (targetField) query.targetField = targetField;
    const config = await EmbeddingConfig.getInstance().findOne(query);
    if (!config) throw new Error('No embedding config found for semantic search');
    return config;
  }

  private providerConfig(provider: string, model: string) {
    const providers = this.currentConfig().providers as Record<
      string,
      Record<string, unknown>
    >;
    const providerConfig = providers[provider] ?? {};
    return {
      ...providerConfig,
      model: String(providerConfig.model ?? model),
    };
  }

  private currentConfig() {
    return ConfigController.getInstance().config as Config;
  }

  protected registerSchemas(): Promise<unknown> {
    const promises = Object.values(models).map(model => {
      const modelInstance = model.getInstance(this.database);
      if (
        Object.keys((modelInstance as ConduitActiveSchema<typeof modelInstance>).fields)
          .length !== 0
      ) {
        return this.database
          .createSchemaFromAdapter(modelInstance)
          .then(() => this.database.migrate(modelInstance.name));
      }
    });
    return Promise.all(promises);
  }
}
