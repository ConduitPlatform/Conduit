import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import type {
  EmbeddingProviderModel,
  EmbeddingProviderSettings,
} from '../config/index.js';
import { validateOperationalLimits } from './storageLimits.js';

export type { EmbeddingProviderModel, EmbeddingProviderSettings };

type CatalogueOptions = { strict?: boolean };

function invalidProviderConfig(message: string): GrpcError {
  return new GrpcError(status.INVALID_ARGUMENT, message);
}

function isStrict(options?: CatalogueOptions): boolean {
  return options?.strict !== false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function trimName(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseDimensions(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return undefined;
  }
  return value;
}

function parseModelEntry(value: unknown, index: number): EmbeddingProviderModel {
  if (!isRecord(value)) {
    throw invalidProviderConfig(`Provider model at index ${index} is invalid`);
  }
  const name = trimName(value.name);
  if (!name) {
    throw invalidProviderConfig(
      `Provider model at index ${index} must have a non-empty name`,
    );
  }
  const dimensions = parseDimensions(value.dimensions);
  if (dimensions == null) {
    throw invalidProviderConfig(
      `Provider model '${name}' dimensions must be a positive integer`,
    );
  }
  return { name, dimensions };
}

function parseModelList(
  values: unknown[],
  options?: CatalogueOptions,
): EmbeddingProviderModel[] {
  const models: EmbeddingProviderModel[] = [];
  const names = new Set<string>();
  const strict = isStrict(options);
  for (const [index, value] of values.entries()) {
    const parsed = strict ? parseModelEntry(value, index) : optionalModelEntry(value);
    if (!parsed) continue;
    if (names.has(parsed.name)) {
      if (strict) {
        throw invalidProviderConfig(`Provider model '${parsed.name}' is duplicated`);
      }
      continue;
    }
    names.add(parsed.name);
    models.push(parsed);
  }
  return models;
}

function optionalModelEntry(value: unknown): EmbeddingProviderModel | undefined {
  if (!isRecord(value)) return undefined;
  const name = trimName(value.name);
  const dimensions = parseDimensions(value.dimensions);
  if (!name || dimensions == null) return undefined;
  return { name, dimensions };
}

function migrateLegacyModels(
  raw: Record<string, unknown>,
  options?: CatalogueOptions,
): EmbeddingProviderModel[] | undefined {
  if (Array.isArray(raw.models) && raw.models.length > 0) return undefined;
  const name = trimName(raw.model);
  if (!name) return [];
  const dimensions = parseDimensions(raw.dimensions);
  if (dimensions == null) {
    if (!isStrict(options)) return [];
    throw invalidProviderConfig(
      `Provider model '${name}' dimensions must be a positive integer`,
    );
  }
  return [{ name, dimensions }];
}

export function providerCatalogueIssues(provider?: {
  models?: Array<{ name?: string; dimensions?: number }>;
  defaultModel?: string;
}): string[] {
  const issues: string[] = [];
  const models = provider?.models;
  if (models != null && !Array.isArray(models)) {
    return ['Embedding provider model catalogue is invalid'];
  }
  const list = models ?? [];
  const names = new Set<string>();
  for (const [index, model] of list.entries()) {
    const name = trimName(model?.name);
    const dimensions = parseDimensions(model?.dimensions);
    if (!name) {
      issues.push(`Provider model at index ${index} must have a non-empty name`);
      continue;
    }
    if (dimensions == null) {
      issues.push(`Provider model '${name}' dimensions must be a positive integer`);
    }
    if (names.has(name)) {
      issues.push(`Provider model '${name}' is duplicated`);
    }
    names.add(name);
  }
  const defaultModel = trimName(provider?.defaultModel);
  if (defaultModel && !names.has(defaultModel)) {
    issues.push(`Provider default model '${defaultModel}' is not in the catalogue`);
  }
  if (!list.length) {
    issues.push('Embedding provider model catalogue is empty');
  }
  return issues;
}

function resolveDefaultModelName(
  models: EmbeddingProviderModel[],
  requested: unknown,
  migratedFromSingular: boolean,
): string {
  const configured = trimName(requested);
  if (configured) {
    return models.some(model => model.name === configured) ? configured : '';
  }
  if (migratedFromSingular) return models[0]?.name ?? '';
  return '';
}

export function normalizeProviderSettings(
  raw: unknown,
  options?: CatalogueOptions,
): EmbeddingProviderSettings {
  const source = isRecord(raw) ? raw : {};
  const migrated = migrateLegacyModels(source, options);
  const migratedFromSingular = migrated != null && migrated.length > 0;
  const models =
    migrated ??
    (Array.isArray(source.models) ? parseModelList(source.models, options) : []);
  const names = new Set(models.map(model => model.name));
  const configuredDefault = trimName(source.defaultModel);
  if (configuredDefault && !names.has(configuredDefault) && isStrict(options)) {
    throw invalidProviderConfig(
      `Provider default model '${configuredDefault}' is not in the catalogue`,
    );
  }
  const defaultModel = resolveDefaultModelName(
    models,
    source.defaultModel,
    migratedFromSingular,
  );
  return {
    ...(typeof source.endpoint === 'string' ? { endpoint: source.endpoint } : {}),
    ...(typeof source.apiKey === 'string' ? { apiKey: source.apiKey } : {}),
    models,
    ...(defaultModel ? { defaultModel } : {}),
  };
}

export function findProviderModel(
  provider: EmbeddingProviderSettings | undefined,
  name?: string,
): EmbeddingProviderModel | undefined {
  const selected = trimName(name);
  if (!selected) return undefined;
  return provider?.models?.find(model => model.name === selected);
}

export function resolveProviderModelName(
  provider: EmbeddingProviderSettings | undefined,
  selected?: string,
): string {
  const trimmed = trimName(selected);
  if (trimmed) return trimmed;
  const defaultModel = trimName(provider?.defaultModel);
  if (defaultModel) return defaultModel;
  return provider?.models?.[0]?.name ?? '';
}

export function assertConfiguredProvider(
  providers: Record<string, EmbeddingProviderSettings> | undefined,
  requested?: string,
): { name: string; settings: EmbeddingProviderSettings } {
  const name = trimName(requested);
  if (!name) {
    throw invalidProviderConfig('Embedding provider is required');
  }
  const settings = providers?.[name];
  if (!settings) {
    throw invalidProviderConfig(
      `Embedding provider '${name}' is not a configured provider`,
    );
  }
  return { name, settings };
}

export function resolveCatalogueModel(
  provider: EmbeddingProviderSettings | undefined,
  requested?: string,
): EmbeddingProviderModel {
  const name = resolveProviderModelName(provider, requested);
  const model = findProviderModel(provider, name);
  if (!model) {
    throw invalidProviderConfig(
      name
        ? `Model '${name}' is not in the catalogue for this provider`
        : 'Provider model catalogue has no selectable model',
    );
  }
  return model;
}

export function resolveCatalogueDimensions(
  model: EmbeddingProviderModel,
  requested?: number,
): number {
  if (requested == null || requested === 0) {
    return model.dimensions;
  }
  if (!Number.isInteger(requested) || requested <= 0) {
    throw invalidProviderConfig('dimensions must be a positive integer');
  }
  if (requested !== model.dimensions) {
    throw invalidProviderConfig(
      `Requested dimensions ${requested} do not match catalogue dimensions ${model.dimensions} for model '${model.name}'`,
    );
  }
  return model.dimensions;
}

export function normalizeEmbeddingsConfig<
  T extends {
    providers?: Record<string, unknown>;
    security?: Record<string, unknown>;
    queue?: Record<string, unknown>;
    storageExtraction?: Record<string, unknown>;
  },
>(config: T, options?: CatalogueOptions): T {
  const next = { ...config };
  if (isRecord(next.security)) {
    const security = { ...next.security };
    delete security.requireGrpcKey;
    next.security = security as T['security'];
  }
  if (isRecord(next.providers)) {
    const providers: Record<string, EmbeddingProviderSettings> = {};
    for (const [key, value] of Object.entries(next.providers)) {
      providers[key] = normalizeProviderSettings(value, options);
    }
    next.providers = providers as T['providers'];
  }
  validateOperationalLimits({
    queue: isRecord(next.queue) ? next.queue : undefined,
    security: isRecord(next.security) ? next.security : undefined,
    storageExtraction: isRecord(next.storageExtraction)
      ? next.storageExtraction
      : undefined,
  });
  return next;
}
