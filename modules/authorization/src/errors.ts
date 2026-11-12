import { status } from '@grpc/grpc-js';
import { defineErrors } from '@conduitplatform/grpc-sdk';

export const errors = defineErrors({
  // Resource definitions
  RESOURCE_DEFINITION_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'Resource definition not found',
    description:
      'The referenced resource definition does not exist. This also applies to the subject or object type of a relation. Define the resource first.',
  },
  RESOURCE_DEFINITION_MALFORMED: {
    grpcCode: status.INVALID_ARGUMENT,
    message:
      'Relations and permissions must be objects, and each permission must be an array of roles',
    description:
      'The relations or permissions of the resource definition have the wrong shape. Both must be objects and each permission must map to an array of roles.',
  },
  RELATED_RESOURCE_NOT_FOUND: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'One or more related resources was not found',
    description:
      'The resource definition references relation target types that are not defined. Define them first.',
  },
  INHERITED_PERMISSION_NOT_FOUND: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Permission not found in related resources',
    description:
      'An inherited permission (relation->permission) refers to a relation that is not declared, or to a permission that does not exist on the related resources.',
  },
  RESOURCE_VERSION_CONFLICT: {
    grpcCode: status.ALREADY_EXISTS,
    message:
      'A divergent resource definition is already registered with the same version',
    description:
      'A resource definition with the same version number but different content already exists. Increase the version number to update it.',
  },

  // Relations
  RELATION_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'Relation not found',
    description:
      'The requested relation does not exist, or no relations matched the given criteria.',
  },
  RELATION_NOT_ALLOWED: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Relation not allowed',
    description:
      'The resource definition of the object does not allow this relation for this subject type.',
  },
  RELATIONS_ALREADY_EXIST: {
    grpcCode: status.ALREADY_EXISTS,
    message: 'Relations already exist',
    description: 'One or more of the requested relations already exist.',
  },
  RELATIONS_REQUIRED: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Missing relations (subject, relation, object)',
    description:
      'An empty list of relations was supplied. Provide at least one relation.',
  },
  INVALID_RELATION_NAME: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Relation must be a plain string',
    description: 'Relation names may only contain letters.',
  },

  // Identifiers and tuples
  INVALID_RESOURCE_IDENTIFIER: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Subject and object must be valid resource identifiers',
    description: 'Subjects, objects and resources must have the form Type:id.',
  },
  INVALID_PERMISSION_ACTION: {
    grpcCode: status.INVALID_ARGUMENT,
    message:
      'Action must start with a letter and contain only letters, numbers, and underscores',
    description:
      'The permission action (or action prefix) has an invalid format. It must start with a letter and contain only letters, numbers and underscores.',
  },
  SUBJECT_AND_OBJECT_IDENTICAL: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Subject and object must be different',
    description:
      'A relation or permission cannot be created or removed with the same subject and object.',
  },

  // Permissions
  PERMISSION_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'Permission does not exist',
    description: 'The permission to revoke does not exist.',
  },

  // Search
  SEARCH_FILTER_REQUIRED: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'At least one search filter must be provided',
    description:
      'Provide at least one of subject, relation, resource, subjectType or resourceType.',
  },

  // Scope
  SCOPE_ACCESS_DENIED: {
    grpcCode: status.PERMISSION_DENIED,
    message: 'User does not have access to scope',
    description: 'The caller lacks the permission to act within the requested scope.',
  },
});
