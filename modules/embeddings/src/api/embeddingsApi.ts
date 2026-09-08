import {
  GrpcError,
  TYPE,
  VectorCapabilities,
  VectorSearchResult,
  VectorSimilarity,
  type ConduitModel,
  type VectorIndexDefinition,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { Config } from '../config/index.js';
import { QueueJobCounts } from '../controllers/queue.controller.js';
import {
  cancelBackfillExecution,
  persistableBackfillRun,
  persistableNewBackfillRun,
  queueBackfillRuns,
  resumeBackfillExecution,
  type BackfillControllerJobData,
  type PersistedBackfillRun,
} from '../utils/backfillExecution.js';
import {
  BackfillGateError,
  embeddingIndexContractFromConfig,
  findTargetVectorIndex,
  grpcErrorFromBackfillGate,
  isEmbeddingVectorIndexQueryable,
  type VectorIndexGate,
} from '../utils/backfillGates.js';
import {
  defaultEmbeddingVectorIndexName,
  diffMaterialEmbeddingConfig,
  hashFieldsToInvalidate,
  isInPlaceDimensionChange,
  materialChangeWarnings,
  nextEmbeddingVectorIndexName,
  sameEmbeddingVectorIndexFamily,
  type MaterialEmbeddingConfigField,
} from '../utils/configChange.js';
import { MAX_QUEUE_BATCH_SIZE } from '../utils/embeddingJobs.js';
import { ACTIVE_BACKFILL_STATES } from '../utils/backfillRun.js';
import {
  assertCanManageEmbeddingConfig,
  assertEmbeddingTargetSchema,
  assertSemanticSearchAccess,
  canManageEmbeddingConfig,
  resolveAdminOperatorContext,
  resolveSourceFieldAllowlist,
} from '../utils/schemaPolicy.js';
import { clampClientSearchLimit } from '../utils/clientSearchContext.js';
import { validateEmbeddingConfigInput } from '../utils/validateEmbeddingConfig.js';
import {
  assertConfigActivation,
  assertSearchExecutable,
  capabilityWarnings,
  emptyQueueCounts,
  indexReadinessWarnings,
  isEmbeddingsReady,
  providerReadinessWarnings,
  SearchGateError,
  grpcErrorFromSearchGate,
} from '../utils/operationalStatus.js';
import {
  mapBackfillRun,
  mapCapabilities,
  mapEmbeddingConfig,
  mapQueueCounts,
  mapSearchHits,
  parseJsonObject,
  type MappedBackfillRun,
  type MappedEmbeddingConfig,
} from '../utils/protoMappers.js';
import { sanitizeErrorMessage } from '../utils/redactConfig.js';

export interface DeclaredSchemaInfo {
  name: string;
  ownerModule?: string;
}

export interface SchemaInfo {
  name: string;
  fields: Record<string, unknown>;
  modelOptions?: { conduit?: { authorization?: { enabled?: boolean } } };
}

export interface EmbeddingConfigRecord {
  _id: string;
  schemaName: string;
  sourceFields: string[];
  targetField: string;
  provider: string;
  modelName: string;
  dimensions: number;
  similarity: string;
  enabled: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface BackfillRunRecord extends PersistedBackfillRun {
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface ConfigStore {
  findMany: (query: Record<string, unknown>) => Promise<EmbeddingConfigRecord[]>;
  findOne: (query: Record<string, unknown>) => Promise<EmbeddingConfigRecord | null>;
  create: (doc: Record<string, unknown>) => Promise<EmbeddingConfigRecord>;
  findByIdAndUpdate: (
    id: string,
    doc: Record<string, unknown>,
  ) => Promise<EmbeddingConfigRecord | null>;
  deleteOne: (query: Record<string, unknown>) => Promise<unknown>;
}

export interface BackfillStore {
  findMany: (
    query: Record<string, unknown>,
    options?: { skip?: number; limit?: number; sort?: Record<string, 1 | -1> },
  ) => Promise<BackfillRunRecord[]>;
  findOne: (query: Record<string, unknown>) => Promise<BackfillRunRecord | null>;
  countDocuments: (query: Record<string, unknown>) => Promise<number>;
  create: (doc: Record<string, unknown>) => Promise<{ _id: string }>;
  findByIdAndUpdate: (
    id: string,
    doc: Record<string, unknown>,
  ) => Promise<BackfillRunRecord | null>;
}

export interface EmbeddingsApiCaller {
  callerModule?: string;
  platformAdmin?: boolean;
}

export interface EmbeddingsApiDeps {
  currentConfig: () => Config;
  getSchema: (schemaName: string) => Promise<SchemaInfo>;
  declaredSchema: (schemaName: string) => Promise<DeclaredSchemaInfo | null>;
  setSchemaExtension: (args: {
    schemaName: string;
    fields: ConduitModel;
  }) => Promise<unknown>;
  getVectorCapabilities: (schemaName?: string) => Promise<VectorCapabilities>;
  getVectorIndexes: (schemaName: string) => Promise<VectorIndexGate[]>;
  vectorSearch: (input: {
    schemaName: string;
    field: string;
    vector: number[];
    filter?: Record<string, unknown>;
    limit?: number;
    userId?: string;
    scope?: string;
    adminOperator?: boolean;
  }) => Promise<VectorSearchResult[]>;
  configs: ConfigStore;
  backfills: BackfillStore;
  getQueueStatus: () => Promise<{ generation: QueueJobCounts; backfill: QueueJobCounts }>;
  enqueueBackfill: (job: BackfillControllerJobData) => Promise<void>;
  createVectorIndex: (
    schemaName: string,
    index: VectorIndexDefinition,
  ) => Promise<unknown>;
  deleteVectorIndex: (schemaName: string, indexName: string) => Promise<unknown>;
  invalidateHashes: (schemaName: string, hashFields: string[]) => Promise<void>;
  embed: (input: string, provider: string, model: string) => Promise<number[]>;
  onConfigChanged?: (schemaName: string) => Promise<void> | void;
}

const DEFAULT_LIST_LIMIT = 25;
const MAX_LIST_LIMIT = 100;

export class EmbeddingsApi {
  constructor(private readonly deps: EmbeddingsApiDeps) {}

  async upsertConfig(
    request: {
      schemaName: string;
      sourceFields: string[];
      targetField: string;
      provider?: string;
      model?: string;
      dimensions: number;
      similarity?: string;
      sourceFieldAllowlist?: string[];
      enabled?: boolean;
    },
    caller: EmbeddingsApiCaller,
  ): Promise<{ config: MappedEmbeddingConfig; warnings: string[] }> {
    const schema = await this.loadTargetSchema(request.schemaName, caller);
    const configDefaults = this.deps.currentConfig();
    const { sourceFieldAllowlist: _allowlist, ...persisted } =
      validateEmbeddingConfigInput(
        {
          ...request,
          sourceFieldAllowlist: resolveSourceFieldAllowlist({
            operatorAllowlist: configDefaults.security.sourceFieldAllowlist,
            requestAllowlist: request.sourceFieldAllowlist,
            platformAdmin: caller.platformAdmin === true,
          }),
        },
        { provider: configDefaults.defaultProvider },
        schema.fields,
      );
    const enabled = request.enabled ?? true;
    const capabilities = await this.deps.getVectorCapabilities(persisted.schemaName);
    let indexes = await this.deps.getVectorIndexes(persisted.schemaName);
    const existing = await this.deps.configs.findOne({
      schemaName: persisted.schemaName,
      targetField: persisted.targetField,
    });
    const changed = existing ? diffMaterialEmbeddingConfig(existing, persisted) : [];
    if (existing && isInPlaceDimensionChange(existing, persisted)) {
      throw new GrpcError(
        status.FAILED_PRECONDITION,
        `Changing vector field '${existing.targetField}' dimensions from ${existing.dimensions} to ${persisted.dimensions} is not allowed. Create a new targetField and run an explicit backfill.`,
      );
    }
    if (capabilities.storage) {
      await this.extendEmbeddingSchema(persisted);
    }
    const provisioned = await this.provisionUpsertIndexes({
      persisted,
      existing,
      capabilities,
      indexes,
    });
    indexes = provisioned.indexes;
    let persistEnabled = enabled && provisioned.persistEnabled;
    const warnings = this.upsertConfigWarnings({
      capabilities,
      indexes,
      persisted,
      enabled,
      configDefaults,
      provisionWarnings: provisioned.provisionWarnings,
    });
    if (enabled && persistEnabled) {
      const activation = this.deferEnablementIfIndexPending({
        replacementIndexName: provisioned.replacementIndexName,
        provisionedIndex: provisioned.provisionedIndex,
        enabled,
        capabilities,
        persisted,
        indexes,
        moduleEnabled: configDefaults.enabled,
      });
      persistEnabled = activation.persistEnabled;
      warnings.push(...activation.warnings);
    }
    const saved = await this.saveUpsertedConfig({
      existing,
      persisted,
      persistEnabled,
      changed,
      capabilities,
      indexes,
      warnings,
    });
    await this.deps.onConfigChanged?.(saved.schemaName);
    return { config: mapEmbeddingConfig(saved), warnings };
  }

  async getConfigs(
    request: { schemaName?: string; id?: string },
    caller: EmbeddingsApiCaller,
  ): Promise<{ configs: MappedEmbeddingConfig[] }> {
    if (request.id) {
      const config = await this.requireConfig({ id: request.id });
      await this.loadTargetSchema(config.schemaName, caller);
      return { configs: [mapEmbeddingConfig(config)] };
    }
    if (request.schemaName) {
      await this.loadTargetSchema(request.schemaName, caller);
      const configs = await this.deps.configs.findMany({
        schemaName: request.schemaName,
      });
      return { configs: configs.map(mapEmbeddingConfig) };
    }
    this.assertOperatorListAccess(caller);
    const configs = await this.deps.configs.findMany({});
    return { configs: configs.map(mapEmbeddingConfig) };
  }

  async deleteConfig(
    request: { id?: string; schemaName?: string; targetField?: string },
    caller: EmbeddingsApiCaller,
  ): Promise<{ config: MappedEmbeddingConfig }> {
    const existing = await this.requireConfig(request);
    await this.loadTargetSchema(existing.schemaName, caller);
    await this.deps.configs.deleteOne({ _id: existing._id });
    await this.deps.onConfigChanged?.(existing.schemaName);
    return { config: mapEmbeddingConfig(existing) };
  }

  async getCapabilities(schemaName?: string): Promise<{
    capabilities: ReturnType<typeof mapCapabilities>;
    warnings: string[];
  }> {
    const capabilities = await this.deps.getVectorCapabilities(schemaName);
    return {
      capabilities: mapCapabilities(capabilities),
      warnings: capabilityWarnings(capabilities),
    };
  }

  async getStatus(schemaName?: string): Promise<{
    enabled: boolean;
    ready: boolean;
    capabilities: ReturnType<typeof mapCapabilities>;
    generationQueue: ReturnType<typeof mapQueueCounts>;
    backfillQueue: ReturnType<typeof mapQueueCounts>;
    warnings: string[];
  }> {
    const config = this.deps.currentConfig();
    const capabilities = await this.deps.getVectorCapabilities(schemaName);
    const queue = await this.deps.getQueueStatus().catch(() => ({
      generation: emptyQueueCounts(),
      backfill: emptyQueueCounts(),
    }));
    const warnings = [
      ...(config.enabled ? [] : ['Embeddings module is disabled']),
      ...capabilityWarnings(capabilities),
      ...providerReadinessWarnings(
        config.providers[config.defaultProvider] ?? Object.values(config.providers)[0],
      ),
    ];
    if (schemaName) {
      const configs = await this.deps.configs.findMany({ schemaName, enabled: true });
      const indexes = await this.deps.getVectorIndexes(schemaName);
      warnings.push(...indexReadinessWarnings(configs, indexes));
    }
    return {
      enabled: config.enabled,
      ready: isEmbeddingsReady({ moduleEnabled: config.enabled, warnings }),
      capabilities: mapCapabilities(capabilities),
      generationQueue: mapQueueCounts(queue.generation),
      backfillQueue: mapQueueCounts(queue.backfill),
      warnings,
    };
  }

  async startBackfill(
    request: {
      schemaName: string;
      batchSize?: number;
      configId?: string;
      onlyMissing?: boolean;
      filter?: string;
    },
    caller: EmbeddingsApiCaller,
  ): Promise<{ queued: number; runs: MappedBackfillRun[]; warnings: string[] }> {
    await this.loadTargetSchema(request.schemaName, caller);
    const filter = this.parseOptionalFilter(request.filter);
    const [configs, capabilities, indexes] = await Promise.all([
      this.deps.configs.findMany({
        schemaName: request.schemaName,
        ...(request.configId ? { _id: request.configId } : { enabled: true }),
      }),
      this.deps.getVectorCapabilities(request.schemaName),
      this.deps.getVectorIndexes(request.schemaName),
    ]);
    const queued = await queueBackfillRuns(
      {
        schemaName: request.schemaName,
        batchSize: request.batchSize,
        configId: request.configId,
        onlyMissing: request.onlyMissing,
        filter,
        maxBatchSize:
          this.deps.currentConfig().queue.maxBatchSize ?? MAX_QUEUE_BATCH_SIZE,
      },
      {
        moduleEnabled: this.deps.currentConfig().enabled,
        capabilities,
        configs,
        indexes,
        createRun: async run =>
          this.deps.backfills.create(persistableNewBackfillRun(run)),
        saveRun: async (id, run) => {
          await this.deps.backfills.findByIdAndUpdate(id, persistableBackfillRun(run));
        },
        findActiveRuns: configId => this.findActiveBackfills(configId),
        enqueueController: job => this.deps.enqueueBackfill(job),
      },
    );
    const runs = await Promise.all(
      queued.runs.map(async item => {
        const persisted = await this.deps.backfills.findOne({ _id: item.id });
        if (!persisted) {
          throw new GrpcError(status.INTERNAL, 'Failed to load queued backfill run');
        }
        return mapBackfillRun(persisted);
      }),
    );
    return {
      queued: queued.queued,
      runs,
      warnings: [
        ...capabilityWarnings(capabilities),
        ...indexReadinessWarnings(configs, indexes),
      ],
    };
  }

  async getBackfill(id: string, caller: EmbeddingsApiCaller): Promise<MappedBackfillRun> {
    const run = await this.requireBackfill(id);
    await this.loadTargetSchema(run.schemaName, caller);
    return mapBackfillRun(run);
  }

  async listBackfills(
    request: {
      schemaName?: string;
      state?: string;
      configId?: string;
      skip?: number;
      limit?: number;
    },
    caller: EmbeddingsApiCaller,
  ): Promise<{ runs: MappedBackfillRun[]; count: number }> {
    if (request.schemaName) {
      await this.loadTargetSchema(request.schemaName, caller);
    } else {
      this.assertOperatorListAccess(caller);
    }
    const query: Record<string, unknown> = {};
    if (request.schemaName) query.schemaName = request.schemaName;
    if (request.state) query.state = request.state;
    if (request.configId) query.configId = request.configId;
    const skip = Math.max(0, request.skip ?? 0);
    const limit = Math.min(
      MAX_LIST_LIMIT,
      Math.max(1, request.limit ?? DEFAULT_LIST_LIMIT),
    );
    const [runs, count] = await Promise.all([
      this.deps.backfills.findMany(query, { skip, limit, sort: { createdAt: -1 } }),
      this.deps.backfills.countDocuments(query),
    ]);
    return { runs: runs.map(mapBackfillRun), count };
  }

  async cancelBackfill(
    id: string,
    caller: EmbeddingsApiCaller,
  ): Promise<{ run: MappedBackfillRun }> {
    const existing = await this.requireBackfill(id);
    await this.loadTargetSchema(existing.schemaName, caller);
    const result = await cancelBackfillExecution({
      run: existing,
      saveRun: async (runId, run) => {
        await this.deps.backfills.findByIdAndUpdate(runId, persistableBackfillRun(run));
      },
    });
    if (!result.ok) {
      throw new GrpcError(
        status.FAILED_PRECONDITION,
        `Backfill run '${id}' cannot be canceled from state '${existing.state}'`,
      );
    }
    return { run: mapBackfillRun({ ...existing, ...result.run }) };
  }

  async resumeBackfill(
    id: string,
    caller: EmbeddingsApiCaller,
  ): Promise<{ run: MappedBackfillRun }> {
    const existing = await this.requireBackfill(id);
    await this.loadTargetSchema(existing.schemaName, caller);
    const config = existing.configId
      ? await this.deps.configs.findOne({ _id: existing.configId })
      : await this.deps.configs.findOne({
          schemaName: existing.schemaName,
          enabled: true,
        });
    const [capabilities, indexes] = await Promise.all([
      this.deps.getVectorCapabilities(existing.schemaName),
      this.deps.getVectorIndexes(existing.schemaName),
    ]);
    assertConfigActivation({
      moduleEnabled: this.deps.currentConfig().enabled,
      capabilities,
      config: config ?? null,
      indexes,
    });
    const result = await resumeBackfillExecution({
      run: existing,
      saveRun: async (runId, run) => {
        await this.deps.backfills.findByIdAndUpdate(runId, persistableBackfillRun(run));
      },
      enqueueController: job => this.deps.enqueueBackfill(job),
    });
    if (!result.ok) {
      throw new GrpcError(
        status.FAILED_PRECONDITION,
        `Backfill run '${id}' cannot be resumed from state '${existing.state}'`,
      );
    }
    return { run: mapBackfillRun({ ...existing, ...result.run }) };
  }

  async semanticSearch(
    request: {
      schemaName: string;
      text: string;
      targetField?: string;
      filter?: string;
      limit?: number;
      userId?: string;
      scope?: string;
      adminOperator?: boolean;
    },
    caller: EmbeddingsApiCaller,
  ): Promise<{ hits: ReturnType<typeof mapSearchHits> }> {
    if (typeof request.text !== 'string' || request.text.trim().length === 0) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Search text is required');
    }
    const adminOperator = caller.platformAdmin
      ? true
      : resolveAdminOperatorContext({
          requested: request.adminOperator,
          callerModule: caller.callerModule,
        });
    const schema = await this.deps.getSchema(request.schemaName);
    const declared = await this.deps.declaredSchema(request.schemaName);
    assertEmbeddingTargetSchema({
      name: schema.name,
      ownerModule: declared?.ownerModule,
    });
    if (schema.modelOptions?.conduit?.authorization?.enabled) {
      assertSemanticSearchAccess({
        userId: request.userId,
        scope: request.scope,
        adminOperator,
      });
    }
    const config = await this.resolveEnabledConfig(
      request.schemaName,
      request.targetField,
    );
    const [capabilities, indexes] = await Promise.all([
      this.deps.getVectorCapabilities(request.schemaName),
      this.deps.getVectorIndexes(request.schemaName),
    ]);
    assertSearchExecutable({
      capabilities,
      config,
      indexes,
    });
    const vector = await this.deps.embed(request.text, config.provider, config.modelName);
    if (vector.length !== config.dimensions) {
      throw new GrpcError(
        status.FAILED_PRECONDITION,
        `Embedding provider returned ${vector.length} dimensions; expected ${config.dimensions}`,
      );
    }
    const results = await this.deps.vectorSearch({
      schemaName: request.schemaName,
      field: config.targetField,
      vector,
      filter: this.parseOptionalFilter(request.filter),
      limit: this.clampSemanticSearchLimit(request.limit, caller),
      userId: request.userId,
      scope: request.scope,
      adminOperator,
    });
    return { hits: mapSearchHits(results) };
  }

  mapGrpcError(err: unknown): { code: number; message: string } {
    if (err instanceof BackfillGateError) {
      const mapped = grpcErrorFromBackfillGate(err);
      return { code: mapped.code, message: sanitizeErrorMessage(mapped) };
    }
    if (err instanceof SearchGateError) {
      const mapped = grpcErrorFromSearchGate(err);
      return { code: mapped.code, message: sanitizeErrorMessage(mapped) };
    }
    if (err instanceof GrpcError) {
      return { code: err.code, message: sanitizeErrorMessage(err) };
    }
    return { code: status.INTERNAL, message: sanitizeErrorMessage(err) };
  }

  private clampSemanticSearchLimit(
    limit: number | undefined,
    caller: EmbeddingsApiCaller,
  ): number | undefined {
    if (caller.platformAdmin || caller.callerModule !== 'router') return limit;
    return clampClientSearchLimit(limit);
  }

  private parseOptionalFilter(filter?: string): Record<string, unknown> | undefined {
    try {
      return parseJsonObject(filter, 'filter');
    } catch {
      throw new GrpcError(status.INVALID_ARGUMENT, 'filter must be a JSON object');
    }
  }

  private async loadTargetSchema(schemaName: string, caller: EmbeddingsApiCaller) {
    const schema = await this.deps.getSchema(schemaName);
    const declared = await this.deps.declaredSchema(schemaName);
    assertEmbeddingTargetSchema({
      name: schema.name,
      ownerModule: declared?.ownerModule,
    });
    if (!caller.platformAdmin) {
      assertCanManageEmbeddingConfig({
        callerModule: caller.callerModule,
        ownerModule: declared?.ownerModule,
        schemaName: schema.name,
      });
    }
    return schema;
  }

  private assertOperatorListAccess(caller: EmbeddingsApiCaller) {
    if (caller.platformAdmin) return;
    if (canManageEmbeddingConfig({ callerModule: caller.callerModule })) return;
    throw new GrpcError(
      status.PERMISSION_DENIED,
      'Listing embedding resources requires the schema owner or a platform operator',
    );
  }

  private async requireConfig(request: {
    id?: string;
    schemaName?: string;
    targetField?: string;
  }): Promise<EmbeddingConfigRecord> {
    const query: Record<string, unknown> = {};
    if (request.id) query._id = request.id;
    else if (request.schemaName && request.targetField) {
      query.schemaName = request.schemaName;
      query.targetField = request.targetField;
    } else {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'id or schemaName and targetField are required',
      );
    }
    const existing = await this.deps.configs.findOne(query);
    if (!existing) {
      throw new GrpcError(status.NOT_FOUND, 'Embedding config not found');
    }
    return existing;
  }

  private async requireBackfill(id: string): Promise<BackfillRunRecord> {
    if (!id) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Backfill id is required');
    }
    const run = await this.deps.backfills.findOne({ _id: id });
    if (!run) {
      throw new GrpcError(status.NOT_FOUND, 'Backfill run not found');
    }
    return run;
  }

  private async resolveEnabledConfig(schemaName: string, targetField?: string) {
    const query: Record<string, unknown> = { schemaName, enabled: true };
    if (targetField) query.targetField = targetField;
    const config = await this.deps.configs.findOne(query);
    if (!config) {
      throw new GrpcError(
        status.NOT_FOUND,
        'No embedding config found for semantic search',
      );
    }
    return config;
  }

  private async extendEmbeddingSchema(persisted: {
    schemaName: string;
    targetField: string;
    dimensions: number;
    similarity: VectorSimilarity;
  }) {
    await this.deps.setSchemaExtension({
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
  }

  private async provisionUpsertIndexes(args: {
    persisted: {
      schemaName: string;
      targetField: string;
      dimensions: number;
      similarity: string;
    };
    existing: EmbeddingConfigRecord | null;
    capabilities: VectorCapabilities;
    indexes: VectorIndexGate[];
  }): Promise<{
    indexes: VectorIndexGate[];
    persistEnabled: boolean;
    provisionedIndex: boolean;
    replacementIndexName?: string;
    provisionWarnings: string[];
  }> {
    let { indexes } = args;
    let persistEnabled = true;
    let provisionedIndex = false;
    let replacementIndexName: string | undefined;
    const provisionWarnings: string[] = [];
    try {
      const matchingIndex = findTargetVectorIndex(
        indexes,
        args.persisted.targetField,
        embeddingIndexContractFromConfig(args.persisted),
      );
      const hasFieldIndex = indexes.some(
        index => index.field === args.persisted.targetField,
      );
      if (!matchingIndex && hasFieldIndex && args.capabilities.indexing) {
        replacementIndexName = await this.recreateVectorIndex(args.persisted, indexes);
        indexes = await this.deps.getVectorIndexes(args.persisted.schemaName);
        provisionedIndex = true;
      } else if (!matchingIndex) {
        provisionedIndex = await this.ensureVectorIndex(
          args.persisted,
          indexes,
          args.capabilities,
        );
        if (provisionedIndex) {
          indexes = await this.deps.getVectorIndexes(args.persisted.schemaName);
        }
      }
      indexes = await this.retireSupersededVectorIndexes({
        schemaName: args.persisted.schemaName,
        targetField: args.persisted.targetField,
        dimensions: args.persisted.dimensions,
        similarity: args.persisted.similarity,
        previousField: args.existing?.targetField,
        indexes,
      });
    } catch (err) {
      persistEnabled = false;
      provisionWarnings.push(
        `Config was saved disabled because vector index provisioning failed for '${args.persisted.targetField}': ${sanitizeErrorMessage(err)}. Repair or create the index and enable the config once Database reports it queryable.`,
      );
    }
    return {
      indexes,
      persistEnabled,
      provisionedIndex,
      replacementIndexName,
      provisionWarnings,
    };
  }

  private upsertConfigWarnings(args: {
    capabilities: VectorCapabilities;
    indexes: VectorIndexGate[];
    persisted: {
      schemaName: string;
      targetField: string;
      dimensions: number;
      similarity: string;
      provider: string;
    };
    enabled: boolean;
    configDefaults: Config;
    provisionWarnings: string[];
  }): string[] {
    const warnings = [
      ...capabilityWarnings(args.capabilities),
      ...indexReadinessWarnings(
        [
          {
            targetField: args.persisted.targetField,
            enabled: args.enabled,
            schemaName: args.persisted.schemaName,
            dimensions: args.persisted.dimensions,
            similarity: args.persisted.similarity,
          },
        ],
        args.indexes,
      ),
      ...providerReadinessWarnings(
        args.configDefaults.providers[args.persisted.provider] ??
          args.configDefaults.providers[args.configDefaults.defaultProvider],
      ),
      ...args.provisionWarnings,
    ];
    if (
      !findTargetVectorIndex(
        args.indexes,
        args.persisted.targetField,
        embeddingIndexContractFromConfig(args.persisted),
      ) &&
      !args.capabilities.indexing
    ) {
      warnings.push(
        `Vector index for field '${args.persisted.targetField}' was not provisioned automatically because Database indexing is unavailable. Create the index manually and wait until it is queryable before enabling this config.`,
      );
    }
    return warnings;
  }

  private deferEnablementIfIndexPending(args: {
    replacementIndexName?: string;
    provisionedIndex: boolean;
    enabled: boolean;
    capabilities: VectorCapabilities;
    persisted: {
      schemaName: string;
      targetField: string;
      dimensions: number;
      similarity: string;
    };
    indexes: VectorIndexGate[];
    moduleEnabled: boolean;
  }): { persistEnabled: boolean; warnings: string[] } {
    try {
      if (args.replacementIndexName) {
        const replacement = args.indexes.find(
          index => index.name === args.replacementIndexName,
        );
        if (!isEmbeddingVectorIndexQueryable(replacement)) {
          throw new BackfillGateError(
            'index_not_queryable',
            `Vector index '${args.replacementIndexName}' is not queryable (status: ${
              replacement?.status ?? 'missing'
            }). Wait until the index is ready before enabling this config.`,
            replacement?.status ?? 'missing',
          );
        }
      }
      assertConfigActivation({
        moduleEnabled: args.moduleEnabled,
        capabilities: args.capabilities,
        config: {
          enabled: args.enabled,
          schemaName: args.persisted.schemaName,
          targetField: args.persisted.targetField,
          dimensions: args.persisted.dimensions,
          similarity: args.persisted.similarity,
        },
        indexes: args.indexes,
      });
      return { persistEnabled: true, warnings: [] };
    } catch (err) {
      const indexPending =
        (err instanceof BackfillGateError && err.reason === 'index_not_queryable') ||
        (err instanceof GrpcError &&
          err.code === status.FAILED_PRECONDITION &&
          /not queryable/.test(err.message));
      if (!indexPending) throw err;
      return {
        persistEnabled: false,
        warnings: [
          args.provisionedIndex
            ? 'Config was saved disabled until the provisioned vector index is queryable. Enable it once Database reports the index ready.'
            : 'Config was saved disabled until the vector index is queryable. Enable it once Database reports the index ready.',
        ],
      };
    }
  }

  private async saveUpsertedConfig(args: {
    existing: EmbeddingConfigRecord | null;
    persisted: Record<string, unknown> & {
      schemaName: string;
      targetField: string;
    };
    persistEnabled: boolean;
    changed: MaterialEmbeddingConfigField[];
    capabilities: VectorCapabilities;
    indexes: VectorIndexGate[];
    warnings: string[];
  }): Promise<EmbeddingConfigRecord> {
    const saved = args.existing
      ? await this.deps.configs.findByIdAndUpdate(args.existing._id, {
          ...args.persisted,
          enabled: args.persistEnabled,
        })
      : await this.deps.configs.create({
          ...args.persisted,
          enabled: args.persistEnabled,
        });
    if (!saved) {
      throw new GrpcError(status.INTERNAL, 'Failed to persist embedding config');
    }
    if (args.existing && args.changed.length) {
      await this.deps.invalidateHashes(
        saved.schemaName,
        hashFieldsToInvalidate(args.existing, saved),
      );
      await this.supersedeActiveBackfills(saved._id);
      let scheduledBackfill = false;
      if (args.persistEnabled) {
        scheduledBackfill = await this.scheduleExplicitBackfill(saved, {
          capabilities: args.capabilities,
          indexes: args.indexes,
        });
      }
      args.warnings.push(...materialChangeWarnings(args.changed, scheduledBackfill));
    }
    return saved;
  }

  private async findActiveBackfills(configId: string): Promise<PersistedBackfillRun[]> {
    const runs: PersistedBackfillRun[] = [];
    for (const state of ACTIVE_BACKFILL_STATES) {
      const found = await this.deps.backfills.findMany({ configId, state });
      runs.push(...found);
    }
    return runs;
  }

  private async ensureVectorIndex(
    next: {
      schemaName: string;
      targetField: string;
      dimensions: number;
      similarity: string;
    },
    indexes: VectorIndexGate[],
    capabilities: VectorCapabilities,
  ): Promise<boolean> {
    if (
      findTargetVectorIndex(
        indexes,
        next.targetField,
        embeddingIndexContractFromConfig(next),
      )
    ) {
      return false;
    }
    if (!capabilities.indexing) return false;
    try {
      await this.deps.createVectorIndex(next.schemaName, {
        field: next.targetField,
        dimensions: next.dimensions,
        similarity: next.similarity as VectorIndexDefinition['similarity'],
        name: defaultEmbeddingVectorIndexName(next.targetField),
      });
    } catch (err) {
      throw new GrpcError(
        status.FAILED_PRECONDITION,
        `Failed to provision vector index for '${next.targetField}': ${sanitizeErrorMessage(err)}`,
      );
    }
    return true;
  }

  private async recreateVectorIndex(
    next: {
      schemaName: string;
      targetField: string;
      dimensions: number;
      similarity: string;
    },
    indexes: VectorIndexGate[],
  ): Promise<string> {
    const replacementName = nextEmbeddingVectorIndexName(next.targetField, indexes);
    try {
      await this.deps.createVectorIndex(next.schemaName, {
        field: next.targetField,
        dimensions: next.dimensions,
        similarity: next.similarity as VectorIndexDefinition['similarity'],
        name: replacementName,
      });
    } catch (err) {
      throw new GrpcError(
        status.FAILED_PRECONDITION,
        `Failed to provision replacement vector index for '${next.targetField}': ${sanitizeErrorMessage(err)}`,
      );
    }
    return replacementName;
  }

  private async retireSupersededVectorIndexes(args: {
    schemaName: string;
    targetField: string;
    dimensions: number;
    similarity: string;
    previousField?: string;
    indexes: VectorIndexGate[];
  }): Promise<VectorIndexGate[]> {
    const selected = findTargetVectorIndex(args.indexes, args.targetField, {
      dimensions: args.dimensions,
      similarity: args.similarity,
    });
    if (!selected?.name || !isEmbeddingVectorIndexQueryable(selected)) {
      return args.indexes;
    }
    const retireNames = new Set<string>();
    for (const index of args.indexes) {
      if (!index.name || index.name === selected.name) continue;
      if (
        index.field === args.targetField &&
        sameEmbeddingVectorIndexFamily(index.name, selected.name)
      ) {
        retireNames.add(index.name);
      }
    }
    if (args.previousField && args.previousField !== args.targetField) {
      const previous = findTargetVectorIndex(args.indexes, args.previousField);
      if (previous?.name && previous.name !== selected.name) {
        retireNames.add(previous.name);
      }
    }
    if (!retireNames.size) return args.indexes;
    for (const name of retireNames) {
      try {
        await this.deps.deleteVectorIndex(args.schemaName, name);
      } catch (err) {
        throw new GrpcError(
          status.FAILED_PRECONDITION,
          `Failed to retire superseded vector index '${name}': ${sanitizeErrorMessage(err)}`,
        );
      }
    }
    return this.deps.getVectorIndexes(args.schemaName);
  }

  private async supersedeActiveBackfills(configId: string): Promise<void> {
    const active = await this.findActiveBackfills(configId);
    for (const run of active) {
      await cancelBackfillExecution({
        run,
        saveRun: async (id, next) => {
          await this.deps.backfills.findByIdAndUpdate(id, persistableBackfillRun(next));
        },
      });
    }
  }

  private async scheduleExplicitBackfill(
    config: EmbeddingConfigRecord,
    args: {
      capabilities: VectorCapabilities;
      indexes: VectorIndexGate[];
    },
  ): Promise<boolean> {
    try {
      const queued = await queueBackfillRuns(
        {
          schemaName: config.schemaName,
          configId: config._id,
          onlyMissing: false,
          maxBatchSize:
            this.deps.currentConfig().queue.maxBatchSize ?? MAX_QUEUE_BATCH_SIZE,
        },
        {
          moduleEnabled: this.deps.currentConfig().enabled,
          capabilities: args.capabilities,
          configs: [config],
          indexes: args.indexes,
          createRun: async run =>
            this.deps.backfills.create(persistableNewBackfillRun(run)),
          saveRun: async (id, run) => {
            await this.deps.backfills.findByIdAndUpdate(id, persistableBackfillRun(run));
          },
          findActiveRuns: configId => this.findActiveBackfills(configId),
          enqueueController: job => this.deps.enqueueBackfill(job),
        },
      );
      return queued.queued > 0;
    } catch (err) {
      if (err instanceof BackfillGateError) {
        return false;
      }
      throw err;
    }
  }
}
