import { status } from '@grpc/grpc-js';
import { defineErrors } from '@conduitplatform/grpc-sdk';

export const errors = defineErrors({
  // Embedding provider (runtime)
  EMBEDDING_PROVIDER_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Embedding provider is missing, unsupported or not configured',
    description:
      'The requested embedding provider is not specified, is not a supported implementation, or is not one of the providers configured for this module. Choose a configured provider.',
  },
  EMBEDDING_PROVIDER_ENDPOINT_NOT_CONFIGURED: {
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Embedding provider endpoint is not configured',
    description:
      'The selected provider has no endpoint in the module configuration. An administrator must configure it.',
  },
  EMBEDDING_INPUT_TOO_LARGE: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Embedding input exceeds the allowed size',
    description:
      'The text to embed is larger than the configured maximum. Send less text.',
  },
  EMBEDDING_PROVIDER_REDIRECT_BLOCKED: {
    grpcCode: status.PERMISSION_DENIED,
    message: 'Embedding provider redirects are not allowed',
    description:
      'The embedding provider endpoint answered with a redirect, which is refused. An administrator must configure the final endpoint URL.',
  },
  EMBEDDING_PROVIDER_TIMEOUT: {
    grpcCode: status.DEADLINE_EXCEEDED,
    message: 'Embedding provider request timed out',
    description: 'The embedding provider did not answer in time. Retry later.',
  },
  EMBEDDING_PROVIDER_UNAVAILABLE: {
    grpcCode: status.UNAVAILABLE,
    message: 'Embedding provider is unavailable',
    description:
      'The embedding provider could not be reached or answered with an error. Retry later.',
  },
  EMBEDDING_PROVIDER_RESPONSE_INVALID: {
    grpcCode: status.UNAVAILABLE,
    message: 'Embedding provider returned an invalid response',
    description:
      'The embedding provider answered with a body that is not valid JSON or contains no embedding. Retry later or check the provider.',
  },
  EMBEDDING_PROVIDER_RESPONSE_TOO_LARGE: {
    grpcCode: status.RESOURCE_EXHAUSTED,
    message: 'Embedding provider response is too large',
    description:
      'The embedding provider answered with more data than the configured maximum response size.',
  },
  EMBEDDING_PROVIDER_DIMENSIONS_MISMATCH: {
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Embedding provider returned an unexpected number of dimensions',
    description:
      'The vector returned by the provider does not have the dimensions of the embedding config. Check the provider model and the config dimensions.',
  },

  // Embedding provider endpoint safety
  EMBEDDING_ENDPOINT_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Embedding provider endpoint is invalid',
    description:
      'The provider endpoint is not a valid URL, does not use HTTPS, or embeds credentials.',
  },
  EMBEDDING_ENDPOINT_ADDRESS_BLOCKED: {
    grpcCode: status.PERMISSION_DENIED,
    message: 'Embedding provider endpoint is not allowed',
    description:
      'The provider endpoint host is denylisted or resolves to a private, loopback or link-local address.',
  },
  EMBEDDING_ENDPOINT_UNRESOLVABLE: {
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Embedding provider endpoint host could not be resolved',
    description: 'The provider endpoint host name could not be resolved through DNS.',
  },

  // Semantic search
  SEMANTIC_SEARCH_SUBJECT_REQUIRED: {
    grpcCode: status.PERMISSION_DENIED,
    message: 'Semantic search requires a subject, scope, or admin operator context',
    description:
      'Semantic search needs an authenticated user (or a scope / operator context) to authorize results.',
  },
  SEARCH_REQUEST_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid search request',
    description:
      'The search text is missing or the limit is not a positive integer. The message says which.',
  },
  FILTER_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'filter must be a JSON object',
    description: 'The filter must be a JSON object.',
  },

  // Access
  EMBEDDING_ACCESS_DENIED: {
    grpcCode: status.PERMISSION_DENIED,
    message: 'Not allowed to manage or list embedding resources for this schema',
    description:
      'The caller is not the schema owner or a platform operator, or the operator context is not permitted for this caller.',
  },
  EMBEDDING_SCHEMA_DENIED: {
    grpcCode: status.PERMISSION_DENIED,
    message: 'Schema cannot be used as an embedding source',
    description:
      'System, internal and embedding-owned schemas cannot be used as embedding sources.',
  },
  EMBEDDING_SCHEMA_NOT_ELIGIBLE: {
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Schema is not enabled or not extendable',
    description:
      'The schema must have CMS handling enabled and be extendable before embeddings can be configured for it.',
  },

  // Config validation
  EMBEDDING_CONFIG_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid embedding config',
    description:
      'A required field is missing or a value (names, similarity, model, dimensions, identifiers) is invalid. The message says which.',
  },
  SOURCE_FIELD_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid source field',
    description:
      'A source field does not exist, is not string-like, is hidden, or looks sensitive. The message says which.',
  },
  EMBEDDING_FIELD_COLLISION: {
    grpcCode: status.ALREADY_EXISTS,
    message:
      'Field already exists on the schema and is not a compatible embeddings extension',
    description:
      'The target or hash field collides with an existing schema field. Choose another target field.',
  },
  EMBEDDING_DIMENSION_CHANGE_NOT_ALLOWED: {
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Changing vector field dimensions in place is not allowed',
    description: 'Create a new target field for the new dimensions instead.',
  },
  EMBEDDING_CONFIG_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'Embedding config not found',
    description: 'No (enabled) embedding config matches the given identifier or schema.',
  },

  // Backfills
  BACKFILL_REQUEST_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid backfill request',
    description:
      'The backfill id, schemaName, configId, batch size or filter is missing or invalid.',
  },
  BACKFILL_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'Backfill run not found',
    description: 'No backfill run matches the given id.',
  },
  BACKFILL_STATE_CONFLICT: {
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Backfill run cannot be changed from its current state',
    description: 'The backfill run cannot be canceled or resumed from its current state.',
  },
  BACKFILL_RUN_INVALID: {
    grpcCode: status.INTERNAL,
    message: 'Backfill run is invalid',
    description: 'The backfill run has no config id or its page could not be built.',
  },

  // Operational gates
  EMBEDDINGS_MODULE_DISABLED: {
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Embeddings module is disabled',
    description: 'Enable the embeddings module before running this operation.',
  },
  VECTOR_UNSUPPORTED: {
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Database does not support Conduit vector search',
    description:
      'The configured database has no vector capability. Use MongoDB Atlas Vector Search or Postgres pgvector.',
  },
  VECTOR_UNAVAILABLE: {
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Vector storage or search is unavailable',
    description: 'The database currently cannot store or search vectors.',
  },
  ENABLED_EMBEDDING_CONFIG_NOT_FOUND: {
    grpcCode: status.FAILED_PRECONDITION,
    message: 'No enabled embedding config found',
    description: 'Create and enable an embedding config for the schema first.',
  },
  EMBEDDING_CONFIG_UNUSABLE: {
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Embedding config is disabled or missing a target vector field',
    description:
      'Enable the embedding config and make sure it has a target vector field.',
  },
  VECTOR_INDEX_NOT_QUERYABLE: {
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Vector index is not queryable',
    description:
      'The vector index is missing or still building. Wait until it is ready; to save a config meanwhile, set enabled=false.',
  },
  VECTOR_INDEX_OPERATION_FAILED: {
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Failed to provision or retire a vector index',
    description:
      'The database rejected a vector index operation. Repair or create the index manually.',
  },

  // Generic
  EMBEDDINGS_OPERATION_FAILED: {
    grpcCode: status.INTERNAL,
    message: 'Embeddings operation failed',
    description: 'An unexpected error occurred while processing the embeddings request.',
  },
});
