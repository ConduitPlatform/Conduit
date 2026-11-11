import { status } from '@grpc/grpc-js';
import { defineErrors } from '@conduitplatform/grpc-sdk';

export const errors = defineErrors({
  // Schemas
  SCHEMA_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'Schema does not exist',
    description: 'No schema matches the given name or id.',
  },
  PENDING_SCHEMA_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'Pending schema does not exist',
    description: 'No introspected (pending) schema matches the given id.',
  },
  CMS_SCHEMA_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: "Schema does not exist or isn't a CMS schema",
    description:
      'The schema is missing or is not managed through the CMS, so it cannot be used here.',
  },
  SCHEMA_DOCUMENTS_NOT_MODIFIABLE: {
    grpcCode: status.NOT_FOUND,
    message: 'Schema does not exist or disallows doc modifications',
    description:
      'The schema is missing or is a system schema whose documents cannot be modified.',
  },
  SCHEMA_IDS_INVALID: {
    grpcCode: status.NOT_FOUND,
    message: 'ids array contains invalid ids',
    description:
      'One or more of the given ids do not match a CMS schema. Remove them and retry.',
  },
  SCHEMA_IDS_REQUIRED: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Argument ids is required and must be a non-empty array',
    description: 'Provide a non-empty array of schema ids.',
  },
  SCHEMA_NAME_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Names cannot include spaces and - characters',
    description: 'The schema name must be a string without spaces or dashes.',
  },
  SCHEMA_NAME_TAKEN: {
    grpcCode: status.ALREADY_EXISTS,
    message: 'Schema name is already in use',
    description: 'Another schema already uses this name. Choose a different name.',
  },
  SCHEMA_FIELDS_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid schema fields configuration',
    description:
      'The schema fields are missing, empty or violate a constraint. The message names the problem.',
  },
  SCHEMA_OPTIONS_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid schema options',
    description:
      'The schema options, CMS CRUD operations or permissions are invalid. The message names the problem.',
  },
  SCHEMA_FIELD_CHANGE_FORBIDDEN: {
    grpcCode: status.PERMISSION_DENIED,
    message: 'Schema field change is not allowed',
    description:
      'Existing fields cannot change type, and vector fields cannot change form or dimensions.',
  },
  SCHEMA_NOT_OWNED: {
    grpcCode: status.PERMISSION_DENIED,
    message: 'Not authorized to modify schema',
    description: 'Only the module that owns a schema can modify or delete it.',
  },
  SCHEMA_SYSTEM_PROTECTED: {
    grpcCode: status.PERMISSION_DENIED,
    message: 'Cannot modify database-owned system schema.',
    description: 'System schemas owned by the database module cannot be modified.',
  },
  SCHEMA_IMPORT_OWNED: {
    grpcCode: status.PERMISSION_DENIED,
    message: 'Schema is already owned by a module',
    description: 'Schemas owned by another module cannot be imported.',
  },
  SCHEMA_IN_USE_BY_CUSTOM_ENDPOINT: {
    grpcCode: status.ABORTED,
    message: 'Cannot delete schema because it is used by a custom endpoint',
    description: 'Delete the custom endpoints that use this schema first.',
  },
  SCHEMA_TOGGLE_FAILED: {
    grpcCode: status.INTERNAL,
    message: 'Could not enable or disable schema',
    description: 'The schema could not be enabled or disabled. Retry later.',
  },
  SCHEMA_PERMISSIONS_UPDATE_FAILED: {
    grpcCode: status.INTERNAL,
    message: 'Could not update schema permissions',
    description: 'The schema permissions could not be updated. Retry later.',
  },
  SCHEMA_OPERATION_FAILED: {
    grpcCode: status.INTERNAL,
    message: 'Schema operation failed',
    description: 'A schema operation failed unexpectedly. Retry later.',
  },
  // Schema extensions
  SCHEMA_NOT_EXTENDABLE: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Schema is not extendable',
    description: 'The target schema does not allow extensions.',
  },
  EXTENSION_FIELD_CONSTRAINT_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: "Schema extension fields can not be 'unique' or 'required'",
    description: "Extension fields cannot be marked 'unique' or 'required'.",
  },
  EXTENSION_FIELD_DUPLICATE: {
    grpcCode: status.ALREADY_EXISTS,
    message: 'Schema extension contains duplicate fields',
    description: 'The extension re-declares a field that already exists on the schema.',
  },
  EXTENSION_SCHEMA_MISSING: {
    grpcCode: status.FAILED_PRECONDITION,
    message: "Cannot create an extension for a schema that doesn't exist",
    description:
      'The schema that the extension targets does not exist. Import or create it first.',
  },
  // Documents
  DOCUMENT_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'Document not found',
    description: 'No document matches the given id, or the caller may not modify it.',
  },
  DOCUMENT_FIELDS_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Wrong input fields!',
    description: 'The update contains fields that are not part of the schema.',
  },
  DOCUMENT_UPDATE_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid update operation for field',
    description:
      'The update operator cannot be applied to the field (for example incrementing a relation or pushing to a non-array field).',
  },
  POPULATE_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid populate path',
    description: 'A populate path cannot be resolved against the schema.',
  },
  SORT_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid sort field value, should be -1 or 1',
    description: 'Sort values must be 1 (ascending) or -1 (descending).',
  },
  RAW_QUERY_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid raw query format',
    description: 'The raw query is missing or does not match the active database type.',
  },
  MUTATION_EVENT_LIMIT_EXCEEDED: {
    grpcCode: status.RESOURCE_EXHAUSTED,
    message: 'updateMany matched too many documents to publish mutation events',
    description:
      'The update matched more documents than can be announced to subscribers. Narrow the filter.',
  },
  DATABASE_OPERATION_FAILED: {
    grpcCode: status.INTERNAL,
    message: 'Database operation failed',
    description: 'A database operation failed unexpectedly. Retry later.',
  },
  // Access control
  MODULE_NOT_AUTHORIZED: {
    grpcCode: status.PERMISSION_DENIED,
    message: 'Module is not authorized to perform this operation on the schema',
    description:
      'The calling module is not allowed to perform this operation on the schema.',
  },
  RESOURCE_ACCESS_DENIED: {
    grpcCode: status.PERMISSION_DENIED,
    message: 'Permission denied',
    description:
      'The authenticated user or scope is not allowed to access this resource.',
  },
  SCHEMA_AUTHORIZATION_UNAVAILABLE: {
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Authorization service is not available',
    description:
      'The schema requires authorization checks but the authorization service is unavailable.',
  },
  // Views
  VIEW_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'View not found',
    description: 'The requested view does not exist.',
  },
  VIEW_CONFLICT: {
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Collection exists but is not a view',
    description: 'A non-view collection already uses the name of the view.',
  },
  VIEW_READ_ONLY: {
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Cannot modify a view',
    description: 'Views are read-only. Write to the underlying schema instead.',
  },
  VIEW_OPERATION_FAILED: {
    grpcCode: status.INTERNAL,
    message: 'View operation failed',
    description: 'A view operation failed unexpectedly. Retry later.',
  },
  // Indexes
  INDEX_DEFINITION_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid index definition',
    description: 'The index definition is invalid. The message names the problem.',
  },
  INDEX_UNIQUE_NOT_ALLOWED: {
    grpcCode: status.PERMISSION_DENIED,
    message: 'Not authorized to create unique index',
    description: 'Only the module that owns the schema may create unique indexes.',
  },
  INDEX_OPERATION_FAILED: {
    grpcCode: status.INTERNAL,
    message: 'Index operation failed',
    description: 'An index operation failed unexpectedly. Retry later.',
  },
  // Vectors
  VECTOR_UNSUPPORTED: {
    grpcCode: status.UNIMPLEMENTED,
    message: 'Vector indexes and search are not supported by this database',
    description: 'The active database does not support vector indexes or search.',
  },
  VECTOR_FIELD_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid vector field',
    description:
      'The field is not a vector field or does not use the required object form.',
  },
  VECTOR_DIMENSIONS_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid vector dimensions',
    description: 'Vector dimensions must be a positive integer and match the field.',
  },
  VECTOR_SIMILARITY_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid vector similarity',
    description: 'The similarity metric is unsupported or does not match the field.',
  },
  VECTOR_INDEX_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid vector index definition',
    description:
      'The vector index definition is incomplete, uses an unsupported method, or targets a non-vector index.',
  },
  VECTOR_INDEX_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'Vector index was not found',
    description: 'No vector index has the given name.',
  },
  VECTOR_INDEX_CONFLICT: {
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Vector index already exists with a different definition',
    description:
      'The index name is taken by a different definition. Drop it or choose another name.',
  },
  VECTOR_INDEX_UNAVAILABLE: {
    grpcCode: status.FAILED_PRECONDITION,
    message: 'No vector index is available for this field',
    description: 'Create a vector index for the field before searching.',
  },
  VECTOR_INDEX_NOT_QUERYABLE: {
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Vector index is not queryable',
    description:
      'The vector index exists but is not ready yet. Retry once it has finished building.',
  },
  VECTOR_INDEX_COMMANDS_UNAVAILABLE: {
    grpcCode: status.FAILED_PRECONDITION,
    message: 'MongoDB Vector Search index commands are not available for this deployment',
    description: 'The MongoDB deployment does not support Vector Search index commands.',
  },
  VECTOR_SEARCH_FILTER_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid vector search filter',
    description: 'The vector search filter is invalid. The message names the problem.',
  },
  VECTOR_SEARCH_LIMITS_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid vector search limits',
    description:
      'limit and numCandidates must be positive integers and numCandidates must not be below limit.',
  },
  VECTOR_SEARCH_NOT_PERMITTED: {
    grpcCode: status.PERMISSION_DENIED,
    message: 'Vector search is not permitted for this caller or context',
    description:
      'Vector search on authorization-enabled schemas requires a subject or scope.',
  },
  // Embeddings jobs
  EMBEDDINGS_JOB_CALLER_NOT_ALLOWED: {
    grpcCode: status.PERMISSION_DENIED,
    message: 'Embeddings job context is only available to the embeddings module',
    description: 'Only the embeddings module may use embeddings job requests.',
  },
  EMBEDDINGS_JOB_ACCESS_DENIED: {
    grpcCode: status.PERMISSION_DENIED,
    message: 'Embeddings job is not allowed to perform this read or write',
    description:
      'The embeddings job requested fields or operators outside what it is allowed to access.',
  },
  EMBEDDINGS_JOB_REQUEST_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Embeddings job request is invalid',
    description: 'The embeddings job request is malformed.',
  },
  // Custom endpoints
  CUSTOM_ENDPOINT_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'Custom endpoint does not exist',
    description: 'No custom endpoint matches the given id.',
  },
  CUSTOM_ENDPOINT_EXISTS: {
    grpcCode: status.ALREADY_EXISTS,
    message: 'Custom endpoint already exists',
    description: 'A custom endpoint with this name already exists.',
  },
  CUSTOM_ENDPOINT_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid custom endpoint definition',
    description:
      'The custom endpoint definition is invalid. The message names the problem.',
  },
  CUSTOM_ENDPOINT_INPUT_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid custom endpoint inputs',
    description: 'The custom endpoint inputs are invalid. The message names the problem.',
  },
  CUSTOM_ENDPOINT_QUERY_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid custom endpoint query',
    description: 'The custom endpoint query is invalid. The message names the problem.',
  },
  CUSTOM_ENDPOINT_ASSIGNMENT_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid custom endpoint assignments',
    description:
      'The custom endpoint assignments are invalid. The message names the problem.',
  },
  CUSTOM_ENDPOINT_AUTH_REQUIRED: {
    grpcCode: status.INVALID_ARGUMENT,
    message:
      'Custom endpoints for schemas with authorization enabled must require authentication',
    description:
      'Enable authentication on the endpoint, because its schema uses authorization.',
  },
  CUSTOM_ENDPOINT_NOT_ALLOWED: {
    grpcCode: status.FAILED_PRECONDITION,
    message:
      "Schema does not define any permissions; can't create non-GET custom endpoint",
    description:
      'Only GET custom endpoints can be created for a schema without permissions.',
  },
  CUSTOM_ENDPOINT_INPUT_MISSING: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'A required custom endpoint input is missing',
    description: 'Provide every input the custom endpoint requires.',
  },
  CUSTOM_ENDPOINT_PAYLOAD_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid document payload built from custom endpoint assignments',
    description: 'The inputs produce an invalid document payload for this endpoint.',
  },
  CUSTOM_ENDPOINT_CONTEXT_MISSING: {
    grpcCode: status.INTERNAL,
    message: 'A required custom endpoint context field is missing',
    description:
      'The endpoint reads a context value that is not available for this request.',
  },
  CUSTOM_ENDPOINT_DEFINITION_CORRUPT: {
    grpcCode: status.INTERNAL,
    message: 'Custom endpoint definition is invalid',
    description:
      'The stored custom endpoint definition is malformed. Contact an administrator.',
  },
  CUSTOM_ENDPOINT_OPERATION_FAILED: {
    grpcCode: status.INTERNAL,
    message: 'Custom endpoint operation failed',
    description:
      'Creating, updating or deleting the custom endpoint failed. Retry later.',
  },
  // Realtime
  LIVE_UPDATES_DISABLED: {
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Live updates are disabled',
    description: 'Live updates are turned off in the module configuration.',
  },
  LIVE_UPDATES_NOT_ENABLED: {
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Live updates are not enabled for this schema',
    description: 'Enable realtime on the schema to subscribe to it.',
  },
  CMS_READ_DISABLED: {
    grpcCode: status.PERMISSION_DENIED,
    message: 'CMS read is not enabled for this schema',
    description: 'Reading is disabled for this schema, so it cannot be subscribed to.',
  },
  AUTHENTICATION_REQUIRED: {
    grpcCode: status.UNAUTHENTICATED,
    message: 'Authentication required',
    description: 'Authenticate before subscribing.',
  },
  SUBSCRIPTION_REQUEST_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid subscription request',
    description:
      'The subscription request is missing the schema or has a malformed documentId.',
  },
  SUBSCRIPTION_DOCUMENT_ID_REQUIRED: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Document ID is required for authorized schemas',
    description:
      'Subscriptions to authorization-enabled schemas must name a document id.',
  },
  SUBSCRIPTION_DENIED: {
    grpcCode: status.PERMISSION_DENIED,
    message: 'Read permission denied',
    description: 'The user may not read this document, so it cannot be subscribed to.',
  },
});

/**
 * DOCUMENT_NOT_FOUND with the legacy text for updates that match nothing the caller may
 * modify. Other modules (storage) still recognise this exact message.
 */
export const DOCUMENT_NOT_MODIFIABLE = {
  ...errors.DOCUMENT_NOT_FOUND,
  message: "Document doesn't exist or can't be modified by user.",
};
