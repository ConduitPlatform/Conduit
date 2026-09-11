import { VectorCapabilities } from '@conduitplatform/grpc-sdk';

export function mongoVectorCapabilities(input: {
  hasSchema: boolean;
  searchIndexCommandsAvailable?: boolean;
  probeError?: string;
}): VectorCapabilities {
  if (!input.hasSchema) {
    return {
      supported: true,
      storage: true,
      indexing: false,
      search: false,
      provider: 'mongodb',
      reason: 'No schema is available to probe MongoDB Vector Search support',
    };
  }
  if (input.searchIndexCommandsAvailable === false) {
    return {
      supported: true,
      storage: true,
      indexing: false,
      search: false,
      provider: 'mongodb',
      reason: 'MongoDB driver does not expose search index commands',
    };
  }
  if (input.probeError) {
    return {
      supported: true,
      storage: true,
      indexing: false,
      search: false,
      provider: 'mongodb',
      reason: input.probeError,
    };
  }
  return {
    supported: true,
    storage: true,
    indexing: true,
    search: true,
    provider: 'mongodb',
  };
}

export function postgresVectorCapabilities(input: {
  pgvectorAvailable: boolean;
  error?: string;
  schemaName?: string;
}): VectorCapabilities {
  if (!input.pgvectorAvailable) {
    const detail = input.error ?? 'pgvector is not available';
    return {
      supported: true,
      storage: false,
      indexing: false,
      search: false,
      provider: 'postgres',
      reason: input.schemaName
        ? `Schema ${input.schemaName} cannot use pgvector: ${detail}`
        : detail,
    };
  }
  return {
    supported: true,
    storage: true,
    indexing: true,
    search: true,
    provider: 'postgres',
  };
}

export function sqlFallbackVectorCapabilities(dialect: string): VectorCapabilities {
  return {
    supported: false,
    storage: true,
    indexing: false,
    search: false,
    provider: 'unsupported',
    reason:
      `${dialect} does not support Conduit vector search; ` +
      'Vector fields can be stored as JSON',
  };
}

export function unsupportedVectorCapabilities(databaseType: string): VectorCapabilities {
  return {
    supported: false,
    storage: false,
    indexing: false,
    search: false,
    provider: 'unsupported',
    reason: `${databaseType} does not support Conduit vector search`,
  };
}
