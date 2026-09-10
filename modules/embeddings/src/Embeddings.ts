import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ConduitGrpcSdk,
  DatabaseProvider,
  GrpcRequest,
  GrpcResponse,
  HealthCheckStatus,
} from '@conduitplatform/grpc-sdk';
import {
  ConfigController,
  ConduitActiveSchema,
  ManagedModule,
} from '@conduitplatform/module-tools';
import AppConfigSchema, { Config } from './config/index.js';
import * as models from './models/index.js';
import {
  BackfillRun,
  EmbeddingConfig,
  EmbeddingDocument,
  EmbeddingSource,
} from './models/index.js';
import { reconcileSourceChunkSchemas } from './utils/genericSource.js';
import { QueueController } from './controllers/queue.controller.js';
import { getProvider, hashEmbeddingInput } from './providers/index.js';
import {
  embeddingOwnedFields,
  isEmbeddingOwnedMutation,
  parseBoundedMutationEvent,
} from './utils/mutationEvents.js';
import {
  buildEmbeddingDocumentSelect,
  generateEmbeddingsForDocument,
  sourceHashField,
} from './utils/processEmbedding.js';
import {
  MAX_QUEUE_BATCH_SIZE,
  parseEmbeddingJobData,
  type EmbeddingJobData,
} from './utils/embeddingJobs.js';
import {
  assertGrpcKeyRequirement,
  callerModuleName,
} from './utils/productionSecurity.js';
import {
  normalizeEmbeddingsConfig,
  resolveProviderModelName,
} from './utils/providerConfig.js';
import { sanitizeErrorMessage } from './utils/redactConfig.js';
import {
  applyBackfillJobOutcome,
  backfillRunFromDocument,
  persistableBackfillRun,
  processBackfillControllerJob,
  type BackfillControllerJobData,
} from './utils/backfillExecution.js';
import { toBackfillCountUpdateQuery } from './utils/backfillRun.js';
import { incrementEmbeddingMetric } from './utils/embeddingMetrics.js';
import metricsSchema from './metrics/index.js';
import { EmbeddingsApi, type DeclaredSchemaInfo } from './api/embeddingsApi.js';
import { AdminHandlers } from './admin/index.js';
import { EmbeddingsRoutes } from './routes/index.js';
import {
  CancelBackfillRequest,
  DeleteEmbeddingConfigRequest,
  DeleteEmbeddingConfigResponse,
  GetBackfillRequest,
  GetCapabilitiesRequest,
  GetCapabilitiesResponse,
  GetConfigsRequest,
  GetConfigsResponse,
  GetStatusRequest,
  GetStatusResponse,
  ListBackfillsRequest,
  ListBackfillsResponse,
  ResumeBackfillRequest,
  SemanticSearchRequest,
  SemanticSearchResponse,
  StartBackfillRequest,
  StartBackfillResponse,
  UpsertConfigRequest,
  UpsertConfigResponse,
  BackfillMutationResponse,
  BackfillRun as BackfillRunMessage,
  UpsertSourceRequest,
  UpdateSourceRequest,
  UpsertSourceResponse,
  GetSourcesRequest,
  GetSourcesResponse,
  GetSourceRequest,
  SourceStatusResponse,
  SourceMutationRequest,
  PurgeSourceResponse,
  SyncDocumentRequest,
  SyncDocumentResponse,
  DeleteDocumentRequest,
  DeleteDocumentResponse,
  EmbeddingSource as EmbeddingSourceMessage,
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
      deleteConfig: this.deleteConfig.bind(this),
      getCapabilities: this.getCapabilities.bind(this),
      getStatus: this.getStatus.bind(this),
      startBackfill: this.startBackfill.bind(this),
      getBackfill: this.getBackfill.bind(this),
      listBackfills: this.listBackfills.bind(this),
      cancelBackfill: this.cancelBackfill.bind(this),
      resumeBackfill: this.resumeBackfill.bind(this),
      semanticSearch: this.semanticSearch.bind(this),
      upsertSource: this.upsertSource.bind(this),
      updateSource: this.updateSource.bind(this),
      getSources: this.getSources.bind(this),
      getSource: this.getSource.bind(this),
      getSourceStatus: this.getSourceStatus.bind(this),
      disableSource: this.disableSource.bind(this),
      revokeSource: this.revokeSource.bind(this),
      purgeSource: this.purgeSource.bind(this),
      syncDocument: this.syncDocument.bind(this),
      deleteDocument: this.deleteDocument.bind(this),
    },
  };

  private database: DatabaseProvider;
  private queueController: QueueController;
  private subscribedSchemas = new Map<string, string[]>();
  private api: EmbeddingsApi;
  private adminRouter?: AdminHandlers;
  private clientRouter?: EmbeddingsRoutes;
  private routerWatchDispose?: () => void;

  constructor(peerManifestRoot?: string) {
    super('embeddings', peerManifestRoot);
    this.updateHealth(HealthCheckStatus.UNKNOWN, true);
  }

  async onServerStart() {
    assertGrpcKeyRequirement(process.env);
    await this.awaitPeersFromManifest();
    this.database = this.grpcSdk.database!;
    await this.registerSchemas();
    await this.reconcileGenericChunkSchemas();
    this.queueController = QueueController.getInstance(this.grpcSdk);
    this.api = this.createApi();
    this.adminRouter = new AdminHandlers(this.grpcServer, this.grpcSdk, this.api);
    await this.configureRuntime();
    this.updateHealth(HealthCheckStatus.SERVING);
  }

  async preConfig(config: Config) {
    assertGrpcKeyRequirement(process.env);
    return normalizeEmbeddingsConfig(config);
  }

  async onConfig() {
    if (!this.database) return;
    await this.configureRuntime();
  }

  async onRegister() {
    this.routerWatchDispose = this.grpcSdk.watchPeer(
      'router',
      serving => {
        if (serving) void this.ensureClientRoutes();
      },
      { edge: 'rising', syncInitialState: true },
    );
  }

  async upsertConfig(
    call: GrpcRequest<UpsertConfigRequest>,
    callback: GrpcResponse<UpsertConfigResponse>,
  ) {
    try {
      const result = await this.api.upsertConfig(call.request, {
        callerModule: callerModuleName(call.metadata),
      });
      callback(null, result);
    } catch (err) {
      callback(this.api.mapGrpcError(err));
    }
  }

  async getConfigs(
    call: GrpcRequest<GetConfigsRequest>,
    callback: GrpcResponse<GetConfigsResponse>,
  ) {
    try {
      const result = await this.api.getConfigs(call.request, {
        callerModule: callerModuleName(call.metadata),
      });
      callback(null, result);
    } catch (err) {
      callback(this.api.mapGrpcError(err));
    }
  }

  async deleteConfig(
    call: GrpcRequest<DeleteEmbeddingConfigRequest>,
    callback: GrpcResponse<DeleteEmbeddingConfigResponse>,
  ) {
    try {
      const result = await this.api.deleteConfig(call.request, {
        callerModule: callerModuleName(call.metadata),
      });
      callback(null, result);
    } catch (err) {
      callback(this.api.mapGrpcError(err));
    }
  }

  async getCapabilities(
    call: GrpcRequest<GetCapabilitiesRequest>,
    callback: GrpcResponse<GetCapabilitiesResponse>,
  ) {
    try {
      const result = await this.api.getCapabilities(call.request.schemaName);
      callback(null, result);
    } catch (err) {
      callback(this.api.mapGrpcError(err));
    }
  }

  async getStatus(
    call: GrpcRequest<GetStatusRequest>,
    callback: GrpcResponse<GetStatusResponse>,
  ) {
    try {
      const result = await this.api.getStatus(call.request.schemaName);
      callback(null, result);
    } catch (err) {
      callback(this.api.mapGrpcError(err));
    }
  }

  async startBackfill(
    call: GrpcRequest<StartBackfillRequest>,
    callback: GrpcResponse<StartBackfillResponse>,
  ) {
    try {
      const result = await this.api.startBackfill(call.request, {
        callerModule: callerModuleName(call.metadata),
      });
      callback(null, result);
    } catch (err) {
      callback(this.api.mapGrpcError(err));
    }
  }

  async getBackfill(
    call: GrpcRequest<GetBackfillRequest>,
    callback: GrpcResponse<BackfillRunMessage>,
  ) {
    try {
      const result = await this.api.getBackfill(call.request.id, {
        callerModule: callerModuleName(call.metadata),
      });
      callback(null, result);
    } catch (err) {
      callback(this.api.mapGrpcError(err));
    }
  }

  async listBackfills(
    call: GrpcRequest<ListBackfillsRequest>,
    callback: GrpcResponse<ListBackfillsResponse>,
  ) {
    try {
      const result = await this.api.listBackfills(call.request, {
        callerModule: callerModuleName(call.metadata),
      });
      callback(null, result);
    } catch (err) {
      callback(this.api.mapGrpcError(err));
    }
  }

  async cancelBackfill(
    call: GrpcRequest<CancelBackfillRequest>,
    callback: GrpcResponse<BackfillMutationResponse>,
  ) {
    try {
      const result = await this.api.cancelBackfill(call.request.id, {
        callerModule: callerModuleName(call.metadata),
      });
      callback(null, result);
    } catch (err) {
      callback(this.api.mapGrpcError(err));
    }
  }

  async resumeBackfill(
    call: GrpcRequest<ResumeBackfillRequest>,
    callback: GrpcResponse<BackfillMutationResponse>,
  ) {
    try {
      const result = await this.api.resumeBackfill(call.request.id, {
        callerModule: callerModuleName(call.metadata),
      });
      callback(null, result);
    } catch (err) {
      callback(this.api.mapGrpcError(err));
    }
  }

  async semanticSearch(
    call: GrpcRequest<SemanticSearchRequest>,
    callback: GrpcResponse<SemanticSearchResponse>,
  ) {
    try {
      const result = await this.api.semanticSearch(call.request, {
        callerModule: callerModuleName(call.metadata),
      });
      callback(null, result);
    } catch (err) {
      callback(this.api.mapGrpcError(err));
    }
  }

  async upsertSource(
    call: GrpcRequest<UpsertSourceRequest>,
    callback: GrpcResponse<UpsertSourceResponse>,
  ) {
    try {
      callback(
        null,
        await this.requireGeneric().upsertSource(call.request, this.caller(call)),
      );
    } catch (err) {
      callback(this.api.mapGrpcError(err));
    }
  }

  async updateSource(
    call: GrpcRequest<UpdateSourceRequest>,
    callback: GrpcResponse<UpsertSourceResponse>,
  ) {
    try {
      callback(
        null,
        await this.requireGeneric().updateSource(call.request, this.caller(call)),
      );
    } catch (err) {
      callback(this.api.mapGrpcError(err));
    }
  }

  async getSources(
    call: GrpcRequest<GetSourcesRequest>,
    callback: GrpcResponse<GetSourcesResponse>,
  ) {
    try {
      callback(
        null,
        await this.requireGeneric().getSources(call.request, this.caller(call)),
      );
    } catch (err) {
      callback(this.api.mapGrpcError(err));
    }
  }

  async getSource(
    call: GrpcRequest<GetSourceRequest>,
    callback: GrpcResponse<EmbeddingSourceMessage>,
  ) {
    try {
      callback(
        null,
        await this.requireGeneric().getSource(call.request.id, this.caller(call)),
      );
    } catch (err) {
      callback(this.api.mapGrpcError(err));
    }
  }

  async getSourceStatus(
    call: GrpcRequest<GetSourceRequest>,
    callback: GrpcResponse<SourceStatusResponse>,
  ) {
    try {
      callback(
        null,
        await this.requireGeneric().getSourceStatus(call.request.id, this.caller(call)),
      );
    } catch (err) {
      callback(this.api.mapGrpcError(err));
    }
  }

  async disableSource(
    call: GrpcRequest<SourceMutationRequest>,
    callback: GrpcResponse<EmbeddingSourceMessage>,
  ) {
    try {
      callback(
        null,
        await this.requireGeneric().disableSource(call.request.id, this.caller(call)),
      );
    } catch (err) {
      callback(this.api.mapGrpcError(err));
    }
  }

  async revokeSource(
    call: GrpcRequest<SourceMutationRequest>,
    callback: GrpcResponse<EmbeddingSourceMessage>,
  ) {
    try {
      callback(
        null,
        await this.requireGeneric().revokeSource(call.request.id, this.caller(call)),
      );
    } catch (err) {
      callback(this.api.mapGrpcError(err));
    }
  }

  async purgeSource(
    call: GrpcRequest<SourceMutationRequest>,
    callback: GrpcResponse<PurgeSourceResponse>,
  ) {
    try {
      callback(
        null,
        await this.requireGeneric().purgeSource(call.request.id, this.caller(call)),
      );
    } catch (err) {
      callback(this.api.mapGrpcError(err));
    }
  }

  async syncDocument(
    call: GrpcRequest<SyncDocumentRequest>,
    callback: GrpcResponse<SyncDocumentResponse>,
  ) {
    try {
      callback(
        null,
        await this.requireGeneric().syncDocument(call.request, this.caller(call)),
      );
    } catch (err) {
      callback(this.api.mapGrpcError(err));
    }
  }

  async deleteDocument(
    call: GrpcRequest<DeleteDocumentRequest>,
    callback: GrpcResponse<DeleteDocumentResponse>,
  ) {
    try {
      callback(
        null,
        await this.requireGeneric().deleteDocument(call.request, this.caller(call)),
      );
    } catch (err) {
      callback(this.api.mapGrpcError(err));
    }
  }

  private caller(call: { metadata?: { get(key: string): Array<string | Buffer> } }) {
    return { callerModule: callerModuleName(call.metadata) };
  }

  private requireGeneric() {
    if (!this.api.generic) {
      throw new Error('Generic embedding sources are not configured');
    }
    return this.api.generic;
  }

  private async ensureClientRoutes() {
    if (!this.api || !this.grpcSdk.router) return;
    this.clientRouter ??= new EmbeddingsRoutes(this.grpcServer, this.grpcSdk, this.api);
    await this.clientRouter.registerRoutes();
  }

  private createApi() {
    return new EmbeddingsApi({
      currentConfig: () => this.currentConfig(),
      getSchema: schemaName => this.database.getSchema(schemaName),
      declaredSchema: schemaName => this.declaredSchema(schemaName),
      setSchemaExtension: extension => this.database.setSchemaExtension(extension),
      getVectorCapabilities: schemaName =>
        this.database.getVectorCapabilities(schemaName),
      getVectorIndexes: schemaName => this.database.getVectorIndexes(schemaName),
      createVectorIndex: (schemaName, index) =>
        this.database.createVectorIndex(schemaName, index),
      deleteVectorIndex: (schemaName, indexName) =>
        this.database.deleteVectorIndex(schemaName, indexName),
      invalidateHashes: async (schemaName, hashFields) => {
        for (const field of hashFields) {
          await this.database.updateMany(
            schemaName,
            {},
            { [field]: null },
            { suppressEvent: true },
          );
        }
      },
      vectorSearch: input => this.database.vectorSearch(input),
      configs: {
        findMany: query => EmbeddingConfig.getInstance().findMany(query),
        findOne: query => EmbeddingConfig.getInstance().findOne(query),
        create: doc => EmbeddingConfig.getInstance().create(doc),
        findByIdAndUpdate: (id, doc) =>
          EmbeddingConfig.getInstance().findByIdAndUpdate(id, doc),
        deleteOne: query => EmbeddingConfig.getInstance().deleteOne(query),
      },
      backfills: {
        findMany: (query, options) => BackfillRun.getInstance().findMany(query, options),
        findOne: query => BackfillRun.getInstance().findOne(query),
        countDocuments: query => BackfillRun.getInstance().countDocuments(query),
        create: doc => BackfillRun.getInstance().create(doc),
        findByIdAndUpdate: (id, doc) =>
          BackfillRun.getInstance().findByIdAndUpdate(id, doc),
      },
      getQueueStatus: () => this.queueController.getQueueStatus(),
      enqueueBackfill: job => this.queueController.addBackfillControllerJob(job),
      embed: (input, provider, model) =>
        getProvider(provider).embed(input, this.providerConfig(provider, model)),
      onConfigChanged: async schemaName => {
        const enabled = await EmbeddingConfig.getInstance().findMany({
          schemaName,
          enabled: true,
        });
        if (this.currentConfig().enabled && enabled.length) {
          this.subscribeToSchema(schemaName);
        } else {
          this.unsubscribeFromSchema(schemaName);
        }
      },
      generic: {
        currentConfig: () => this.currentConfig(),
        sources: {
          findMany: (query, options) =>
            EmbeddingSource.getInstance().findMany(query, options),
          findOne: query => EmbeddingSource.getInstance().findOne(query),
          countDocuments: query => EmbeddingSource.getInstance().countDocuments(query),
          create: doc => EmbeddingSource.getInstance().create(doc),
          findByIdAndUpdate: (id, doc) =>
            EmbeddingSource.getInstance().findByIdAndUpdate(id, doc),
          deleteOne: query => EmbeddingSource.getInstance().deleteOne(query),
        },
        documents: {
          findMany: query => EmbeddingDocument.getInstance().findMany(query),
          findOne: query => EmbeddingDocument.getInstance().findOne(query),
          countDocuments: query => EmbeddingDocument.getInstance().countDocuments(query),
          create: doc => EmbeddingDocument.getInstance().create(doc),
          findByIdAndUpdate: (id, doc) =>
            EmbeddingDocument.getInstance().findByIdAndUpdate(id, doc),
          deleteOne: query => EmbeddingDocument.getInstance().deleteOne(query),
          deleteMany: query => EmbeddingDocument.getInstance().deleteMany(query),
        },
        chunks: {
          findMany: (schemaName, query) =>
            this.database.findMany(schemaName, query as never),
          upsertMany: async (schemaName, docs) => {
            for (const doc of docs) {
              const existing = await this.database.findOne<{ _id?: string }>(schemaName, {
                documentId: doc.documentId,
                chunkKey: doc.chunkKey,
              } as never);
              if (existing?._id) {
                await this.database.findByIdAndUpdate(schemaName, existing._id, doc);
              } else {
                await this.database.create(schemaName, doc);
              }
            }
          },
          deleteMany: (schemaName, query) =>
            this.database.deleteMany(schemaName, query as never),
        },
        chunkSchemas: {
          createSchemaFromAdapter: schema =>
            this.database.createSchemaFromAdapter(schema),
          migrate: schemaName => this.database.migrate(schemaName),
          getVectorIndexes: schemaName => this.database.getVectorIndexes(schemaName),
          createVectorIndex: (schemaName, index) =>
            this.database.createVectorIndex(schemaName, index),
        },
        getVectorCapabilities: schemaName =>
          this.database.getVectorCapabilities(schemaName),
        getVectorIndexes: schemaName => this.database.getVectorIndexes(schemaName),
        vectorSearch: input => this.database.vectorSearch(input),
        embed: (input, provider, model) =>
          getProvider(provider).embed(input, this.providerConfig(provider, model)),
        ...(this.grpcSdk.authorization
          ? {
              can: (check: { subject: string; actions: string[]; resource: string }) =>
                this.grpcSdk.authorization!.can(check),
              createRelation: (relation: {
                subject: string;
                relation: string;
                resource: string;
              }) => this.grpcSdk.authorization!.createRelation(relation),
              deleteAllRelations: (query: { resource?: string; subject?: string }) =>
                this.grpcSdk.authorization!.deleteAllRelations(query),
            }
          : {}),
      },
    });
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

  private subscribeToSchema(schemaName: string) {
    if (this.subscribedSchemas.has(schemaName)) return;
    const events = ['create', 'update', 'createMany', 'updateMany'] as const;
    const ids = events.map(event => {
      const id = `embeddings:${schemaName}:${event}`;
      this.grpcSdk.bus?.subscribe(
        `database:${event}:${schemaName}`,
        message => this.enqueueMutation(schemaName, message),
        id,
      );
      return id;
    });
    this.subscribedSchemas.set(schemaName, ids);
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
      drainTimeoutMs: this.currentConfig().queue.drainTimeoutMs,
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
    ).filter((config): config is EmbeddingConfig => Boolean(config));
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
          sourceHashField(config.targetField),
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
    await applyBackfillJobOutcome({
      runId,
      outcome,
      incrementCounts: async (id, patch) => {
        const updated = await BackfillRun.getInstance().findByIdAndUpdate(
          id,
          toBackfillCountUpdateQuery(patch),
        );
        return updated ? backfillRunFromDocument(updated) : null;
      },
    });
  }

  private async declaredSchema(schemaName: string) {
    return this.database.findOne<DeclaredSchemaInfo>(
      '_DeclaredSchema',
      { name: schemaName },
      { select: 'name ownerModule fields extensions' },
    );
  }

  private providerConfig(provider: string, model: string) {
    const config = this.currentConfig();
    const providerConfig = config.providers[provider] ?? {};
    return {
      endpoint: providerConfig.endpoint,
      apiKey: providerConfig.apiKey,
      model: resolveProviderModelName(providerConfig, model),
      timeoutMs: config.security.embedTimeoutMs,
      maxInputBytes: config.security.maxEmbedInputBytes,
      maxResponseBytes: config.security.maxEmbedResponseBytes,
    };
  }

  private currentConfig() {
    return normalizeEmbeddingsConfig(ConfigController.getInstance().config as Config, {
      strict: false,
    });
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

  private async reconcileGenericChunkSchemas() {
    const sources = await EmbeddingSource.getInstance().findMany({});
    await reconcileSourceChunkSchemas(
      sources,
      {
        createSchemaFromAdapter: schema => this.database.createSchemaFromAdapter(schema),
        migrate: schemaName => this.database.migrate(schemaName),
        getVectorIndexes: schemaName => this.database.getVectorIndexes(schemaName),
        createVectorIndex: (schemaName, index) =>
          this.database.createVectorIndex(schemaName, index),
      },
      (id, state) =>
        EmbeddingSource.getInstance().findByIdAndUpdate(id, {
          chunkSchemaName: state.schemaName,
          chunkIndexName: state.indexName,
        }),
    );
  }
}
