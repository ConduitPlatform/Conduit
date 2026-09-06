import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ConduitGrpcSdk,
  DatabaseProvider,
  GrpcError,
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
import { status } from '@grpc/grpc-js';
import AppConfigSchema, { Config } from './config/index.js';
import * as models from './models/index.js';
import { BackfillRun, EmbeddingConfig } from './models/index.js';
import { QueueController } from './controllers/queue.controller.js';
import { getProvider, hashEmbeddingInput } from './providers/index.js';
import { validateEmbeddingConfigInput } from './utils/validateEmbeddingConfig.js';
import {
  embeddingOwnedFields,
  isEmbeddingOwnedMutation,
  parseBoundedMutationEvent,
} from './utils/mutationEvents.js';
import {
  buildEmbeddingDocumentSelect,
  generateEmbeddingsForDocument,
} from './utils/processEmbedding.js';
import {
  MAX_QUEUE_BATCH_SIZE,
  parseEmbeddingJobData,
  type EmbeddingJobData,
} from './utils/embeddingJobs.js';
import {
  assertCanManageEmbeddingConfig,
  assertEmbeddingTargetSchema,
  assertSemanticSearchAccess,
  resolveAdminOperatorContext,
} from './utils/schemaPolicy.js';
import {
  assertGrpcKeyRequirement,
  callerModuleName,
} from './utils/productionSecurity.js';
import { sanitizeErrorMessage } from './utils/redactConfig.js';
import {
  applyBackfillJobOutcome,
  backfillRunFromDocument,
  persistableBackfillRun,
  processBackfillControllerJob,
  queueBackfillRuns,
  type BackfillControllerJobData,
} from './utils/backfillExecution.js';
import { BackfillGateError, grpcErrorFromBackfillGate } from './utils/backfillGates.js';
import { incrementEmbeddingMetric } from './utils/embeddingMetrics.js';
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
  private subscribedSchemas = new Map<string, string[]>();

  constructor(peerManifestRoot?: string) {
    super('embeddings', peerManifestRoot);
    this.updateHealth(HealthCheckStatus.UNKNOWN, true);
  }

  async onServerStart() {
    assertGrpcKeyRequirement(process.env);
    await this.awaitPeersFromManifest();
    this.database = this.grpcSdk.database!;
    await this.registerSchemas();
    this.queueController = QueueController.getInstance(this.grpcSdk);
    await this.configureRuntime();
    this.updateHealth(HealthCheckStatus.SERVING);
  }

  async preConfig(config: Config) {
    assertGrpcKeyRequirement(process.env, config);
    return config;
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
      const schema = await this.database.getSchema(call.request.schemaName);
      const declared = await this.declaredSchema(call.request.schemaName);
      assertEmbeddingTargetSchema({
        name: schema.name,
        ownerModule: declared?.ownerModule,
      });
      assertCanManageEmbeddingConfig({
        callerModule: callerModuleName(call.metadata),
        ownerModule: declared?.ownerModule,
        schemaName: schema.name,
      });
      const { sourceFieldAllowlist: _allowlist, ...persisted } =
        validateEmbeddingConfigInput(
          {
            ...call.request,
            sourceFieldAllowlist: [
              ...(this.currentConfig().security.sourceFieldAllowlist ?? []),
              ...(call.request.sourceFieldAllowlist ?? []),
            ],
          },
          { provider: this.currentConfig().defaultProvider },
          schema.fields,
        );
      await this.database.setSchemaExtension({
        schemaName: persisted.schemaName,
        fields: {
          [persisted.targetField]: {
            type: TYPE.Vector,
            dimensions: persisted.dimensions,
            similarity: persisted.similarity,
            select: false,
          },
          [`${persisted.targetField}SourceHash`]: {
            type: TYPE.String,
            required: false,
            select: false,
          },
        },
      });
      const model = EmbeddingConfig.getInstance();
      const existing = await model.findOne({
        schemaName: persisted.schemaName,
        targetField: persisted.targetField,
      });
      if (existing) {
        await model.findByIdAndUpdate(existing._id, persisted);
      } else {
        await model.create({ ...persisted, enabled: true });
      }
      if (this.currentConfig().enabled) {
        this.subscribeToSchema(persisted.schemaName);
      }
      callback(null, { result: 'Embedding config saved' });
    } catch (err) {
      callback(this.grpcError(err));
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
      callback(this.grpcError(err));
    }
  }

  async startBackfill(
    call: GrpcRequest<BackfillRequest>,
    callback: GrpcResponse<EmbeddingsQueryResponse>,
  ) {
    try {
      const schema = await this.database.getSchema(call.request.schemaName);
      const declared = await this.declaredSchema(call.request.schemaName);
      assertEmbeddingTargetSchema({
        name: schema.name,
        ownerModule: declared?.ownerModule,
      });
      assertCanManageEmbeddingConfig({
        callerModule: callerModuleName(call.metadata),
        ownerModule: declared?.ownerModule,
        schemaName: schema.name,
      });
      const [configs, capabilities, indexes] = await Promise.all([
        EmbeddingConfig.getInstance().findMany({
          schemaName: call.request.schemaName,
          enabled: true,
        }),
        this.database.getVectorCapabilities(call.request.schemaName),
        this.database.getVectorIndexes(call.request.schemaName),
      ]);
      const queued = await queueBackfillRuns(
        {
          schemaName: call.request.schemaName,
          batchSize: call.request.batchSize,
          maxBatchSize: this.currentConfig().queue.maxBatchSize ?? MAX_QUEUE_BATCH_SIZE,
        },
        {
          moduleEnabled: this.currentConfig().enabled,
          capabilities,
          configs,
          indexes,
          createRun: async run => {
            const created = await BackfillRun.getInstance().create(
              persistableBackfillRun(run),
            );
            return { _id: created._id };
          },
          enqueueController: job => this.queueController.addBackfillControllerJob(job),
        },
      );
      callback(null, { result: JSON.stringify(queued) });
    } catch (err) {
      callback(this.grpcError(err));
    }
  }

  async semanticSearch(
    call: GrpcRequest<SemanticSearchRequest>,
    callback: GrpcResponse<EmbeddingsQueryResponse>,
  ) {
    try {
      const adminOperator = resolveAdminOperatorContext({
        requested: call.request.adminOperator,
        callerModule: callerModuleName(call.metadata),
      });
      const schema = await this.database.getSchema(call.request.schemaName);
      if (schema.modelOptions?.conduit?.authorization?.enabled) {
        assertSemanticSearchAccess({
          userId: call.request.userId,
          scope: call.request.scope,
          adminOperator,
        });
      }
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
        throw new GrpcError(
          status.FAILED_PRECONDITION,
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
        adminOperator,
      });
      callback(null, { result: JSON.stringify(results) });
    } catch (err) {
      callback(this.grpcError(err));
    }
  }

  private async configureRuntime() {
    const config = this.currentConfig();
    this.queueController ??= QueueController.getInstance(this.grpcSdk);
    if (!config.enabled) {
      await this.queueController.closeWorker();
      this.unsubscribeAll();
      return;
    }
    this.queueController.setBackfillJobOutcomeHandler((runId, outcome) =>
      this.recordBackfillJobOutcome(runId, outcome),
    );
    await this.queueController.ensureWorker(
      data => this.processEmbeddingJob(data),
      config.queue.concurrency,
    );
    await this.queueController.ensureBackfillWorker(
      data => this.processBackfillJob(data),
      1,
    );
    const configs = await EmbeddingConfig.getInstance().findMany({ enabled: true });
    const enabledSchemas = new Set(configs.map(item => item.schemaName));
    for (const schemaName of this.subscribedSchemas.keys()) {
      if (!enabledSchemas.has(schemaName)) {
        this.unsubscribeFromSchema(schemaName);
      }
    }
    configs.forEach(item => this.subscribeToSchema(item.schemaName));
  }

  private schemaSubscriptionIds(schemaName: string): [string, string, string, string] {
    const idPrefix = `embeddings:${schemaName}`;
    return [
      `${idPrefix}:create`,
      `${idPrefix}:update`,
      `${idPrefix}:createMany`,
      `${idPrefix}:updateMany`,
    ];
  }

  private subscribeToSchema(schemaName: string) {
    if (this.subscribedSchemas.has(schemaName)) return;
    const [createId, updateId, createManyId, updateManyId] =
      this.schemaSubscriptionIds(schemaName);
    this.grpcSdk.bus?.subscribe(
      `database:create:${schemaName}`,
      message => this.enqueueMutation(schemaName, message),
      createId,
    );
    this.grpcSdk.bus?.subscribe(
      `database:update:${schemaName}`,
      message => this.enqueueMutation(schemaName, message),
      updateId,
    );
    this.grpcSdk.bus?.subscribe(
      `database:createMany:${schemaName}`,
      message => this.enqueueMutation(schemaName, message),
      createManyId,
    );
    this.grpcSdk.bus?.subscribe(
      `database:updateMany:${schemaName}`,
      message => this.enqueueMutation(schemaName, message),
      updateManyId,
    );
    this.subscribedSchemas.set(schemaName, [
      createId,
      updateId,
      createManyId,
      updateManyId,
    ]);
  }

  private unsubscribeFromSchema(schemaName: string) {
    const ids = this.subscribedSchemas.get(schemaName);
    if (!ids) return;
    ids.forEach(id => this.grpcSdk.bus?.unsubscribe(id));
    this.subscribedSchemas.delete(schemaName);
  }

  private unsubscribeAll() {
    [...this.subscribedSchemas.keys()].forEach(schemaName =>
      this.unsubscribeFromSchema(schemaName),
    );
  }

  private enqueueMutation(schemaName: string, message: string) {
    this.enqueueMutationAsync(schemaName, message).catch(err =>
      ConduitGrpcSdk.Logger.error(sanitizeErrorMessage(err)),
    );
  }

  private async enqueueMutationAsync(schemaName: string, message: string) {
    const parsed = parseBoundedMutationEvent(
      message,
      this.currentConfig().security.maxMutationEventIds,
    );
    if (!parsed.ok) {
      incrementEmbeddingMetric('malformedEvents');
      return;
    }
    if (!parsed.event.ids.length) return;
    const configs = await EmbeddingConfig.getInstance().findMany({
      schemaName,
      enabled: true,
    });
    if (!configs.length) return;
    if (isEmbeddingOwnedMutation(parsed.event.payload, embeddingOwnedFields(configs))) {
      return;
    }
    const attempts = this.currentConfig().queue.attempts;
    await this.queueController.addBulkEmbeddingJobs(
      parsed.event.ids.map(documentId => ({ schemaName, documentId })),
      attempts,
    );
  }

  private async processBackfillJob(data: BackfillControllerJobData) {
    await processBackfillControllerJob(data, {
      maxBatchSize: this.currentConfig().queue.maxBatchSize ?? MAX_QUEUE_BATCH_SIZE,
      moduleEnabled: this.currentConfig().enabled,
      getRun: async id => {
        const doc = await BackfillRun.getInstance().findOne({ _id: id });
        return doc ? backfillRunFromDocument(doc) : null;
      },
      saveRun: (id, run) =>
        BackfillRun.getInstance()
          .findByIdAndUpdate(id, persistableBackfillRun(run))
          .then(() => undefined),
      findPage: (schemaName, page) =>
        this.database.findMany<{ _id?: unknown }>(schemaName, page.query, {
          sort: page.sort,
          limit: page.limit,
          select: '_id',
        }),
      enqueueEmbeddingJobs: jobs =>
        this.queueController.addBulkEmbeddingJobs(
          jobs,
          this.currentConfig().queue.attempts,
        ),
      enqueueContinuation: job => this.queueController.addBackfillControllerJob(job),
      getCapabilities: schemaName => this.database.getVectorCapabilities(schemaName),
      getConfig: id => EmbeddingConfig.getInstance().findOne({ _id: id }),
      getIndexes: schemaName => this.database.getVectorIndexes(schemaName),
    });
  }

  private async processEmbeddingJob(data: EmbeddingJobData) {
    const parsed = parseEmbeddingJobData(data);
    if (!parsed.ok) {
      incrementEmbeddingMetric('malformedJobs');
      return;
    }
    const configs = (
      parsed.data.configId
        ? [await EmbeddingConfig.getInstance().findOne({ _id: parsed.data.configId })]
        : await EmbeddingConfig.getInstance().findMany({
            schemaName: parsed.data.schemaName,
            enabled: true,
          })
    ).filter(Boolean) as EmbeddingConfig[];
    const matching = configs.filter(
      config => config.enabled && config.schemaName === parsed.data.schemaName,
    );
    if (!matching.length) {
      await this.recordBackfillJobOutcome(parsed.data.backfillRunId, 'processed');
      return;
    }
    const allowedFields = [
      ...new Set(
        matching.flatMap(config => [
          ...config.sourceFields,
          `${config.targetField}SourceHash`,
        ]),
      ),
    ];
    const doc = await this.database.findOne<Record<string, unknown>>(
      parsed.data.schemaName,
      { _id: parsed.data.documentId },
      {
        select: buildEmbeddingDocumentSelect(matching),
        embeddingsJob: true,
        embeddingsAllowedFields: allowedFields,
      },
    );
    if (!doc) {
      await this.recordBackfillJobOutcome(parsed.data.backfillRunId, 'processed');
      return;
    }
    const result = await generateEmbeddingsForDocument({
      doc,
      configs: matching,
      hashInput: hashEmbeddingInput,
      embed: (input, config) =>
        getProvider(config.provider).embed(
          input,
          this.providerConfig(config.provider, config.modelName ?? ''),
        ),
      update: (fields, options) =>
        this.database.findByIdAndUpdate(
          parsed.data.schemaName,
          parsed.data.documentId,
          fields,
          {
            ...options,
            embeddingsJob: true,
          },
        ),
    });
    incrementEmbeddingMetric('generated', result.generated);
    incrementEmbeddingMetric('skipped', result.skipped);
    await this.recordBackfillJobOutcome(parsed.data.backfillRunId, 'processed');
  }

  private async recordBackfillJobOutcome(
    runId: string | undefined,
    outcome: 'processed' | 'failed',
  ) {
    if (!runId) return;
    const doc = await BackfillRun.getInstance().findOne({ _id: runId });
    if (!doc) return;
    const run = backfillRunFromDocument(doc);
    await applyBackfillJobOutcome({
      run,
      outcome,
      saveRun: (id, next) =>
        BackfillRun.getInstance()
          .findByIdAndUpdate(id, persistableBackfillRun(next))
          .then(() => undefined),
    });
  }

  private async declaredSchema(schemaName: string) {
    return this.database.findOne<{ name: string; ownerModule: string }>(
      '_DeclaredSchema',
      { name: schemaName },
      { select: 'name ownerModule' },
    );
  }

  private grpcError(err: unknown) {
    if (err instanceof BackfillGateError) {
      const mapped = grpcErrorFromBackfillGate(err);
      return { code: mapped.code, message: sanitizeErrorMessage(mapped) };
    }
    if (err instanceof GrpcError) {
      return { code: err.code, message: sanitizeErrorMessage(err) };
    }
    return { code: status.INTERNAL, message: sanitizeErrorMessage(err) };
  }

  private providerConfig(provider: string, model: string) {
    const config = this.currentConfig();
    const providers = config.providers as Record<string, Record<string, unknown>>;
    const providerConfig = providers[provider] ?? {};
    return {
      endpoint:
        typeof providerConfig.endpoint === 'string' ? providerConfig.endpoint : undefined,
      apiKey:
        typeof providerConfig.apiKey === 'string' ? providerConfig.apiKey : undefined,
      model: String(providerConfig.model ?? model),
      allowedHosts: [
        ...new Set(
          ((providerConfig.allowedHosts as string[] | undefined) ?? []).filter(Boolean),
        ),
      ],
      timeoutMs: config.security.embedTimeoutMs,
      maxInputBytes: config.security.maxEmbedInputBytes,
      maxResponseBytes: config.security.maxEmbedResponseBytes,
    };
  }

  private async resolveConfig(schemaName: string, targetField?: string) {
    const query: Record<string, unknown> = { schemaName, enabled: true };
    if (targetField) query.targetField = targetField;
    const config = await EmbeddingConfig.getInstance().findOne(query);
    if (!config) {
      throw new GrpcError(
        status.NOT_FOUND,
        'No embedding config found for semantic search',
      );
    }
    return config;
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
