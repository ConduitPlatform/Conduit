import { status } from '@grpc/grpc-js';
import { defineErrors } from '@conduitplatform/grpc-sdk';

export const errors = defineErrors({
  // Not found
  FILE_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'File does not exist',
    description: 'No file matches the given id. Check the id and try again.',
  },
  CONTAINER_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'Container does not exist',
    description: 'No container matches the given name. Create the container first.',
  },
  FOLDER_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'Folder does not exist',
    description: 'No folder matches the given id. Check the id and try again.',
  },

  // Conflicts
  FILE_ALREADY_EXISTS: {
    grpcCode: status.ALREADY_EXISTS,
    message: 'File already exists',
    description:
      'A file with this name already exists in the folder and container. Use a different name or enable suffixOnNameConflict.',
  },
  FOLDER_ALREADY_EXISTS: {
    grpcCode: status.ALREADY_EXISTS,
    message: 'Folder already exists',
    description: 'A folder with this path already exists in the container.',
  },
  CONTAINER_ALREADY_EXISTS: {
    grpcCode: status.ALREADY_EXISTS,
    message: 'Container already exists',
    description: 'A container with this name already exists.',
  },

  // Validation
  INVALID_FILE_ID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'The provided id is invalid',
    description: 'The file id is missing or is not a string.',
  },
  INVALID_FILE_DATA: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid data provided',
    description: 'The file data must be provided as a base64 encoded string.',
  },
  FOLDER_NAME_EMPTY: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Folder name may not be empty',
    description: 'The folder name resolves to the root path. Provide a non-empty name.',
  },
  PRIVATE_FILE_IN_PUBLIC_CONTAINER: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Files in public containers must be public',
    description:
      'A non-public file cannot be stored in a public container. Mark the file as public or use a private container.',
  },

  // Permissions
  FILE_ACCESS_NOT_PUBLIC: {
    grpcCode: status.PERMISSION_DENIED,
    message: 'File access is not public',
    description:
      'The request carries no authenticated user, so only public files are accessible.',
  },
  FILE_ACTION_NOT_ALLOWED: {
    grpcCode: status.PERMISSION_DENIED,
    message: 'You are not allowed to perform this action on the file',
    description: 'The user lacks the required permission on the file.',
  },
  SCOPE_CREATE_FILE_DENIED: {
    grpcCode: status.PERMISSION_DENIED,
    message: 'You are not allowed to create files in this scope',
    description: 'The user lacks edit permission on the requested scope.',
  },
  CONTAINER_CREATE_FILE_DENIED: {
    grpcCode: status.PERMISSION_DENIED,
    message: 'You are not allowed to create files in this container',
    description: 'The user lacks edit permission on the container.',
  },
  FOLDER_EDIT_DENIED: {
    grpcCode: status.PERMISSION_DENIED,
    message: 'You are not allowed to edit files in this folder',
    description: 'The user lacks edit permission on the folder.',
  },
  PERSONAL_FOLDER_CREATE_DENIED: {
    grpcCode: status.PERMISSION_DENIED,
    message: 'You are not allowed to create this folder',
    description: "Folders inside another user's personal folder cannot be created.",
  },
  CONTAINER_CREATION_NOT_ALLOWED: {
    grpcCode: status.PERMISSION_DENIED,
    message: 'Container creation is not allowed!',
    description:
      'Container creation is disabled in the storage configuration (allowContainerCreation).',
  },

  // Internal / availability
  FILE_DELETE_FAILED: {
    grpcCode: status.INTERNAL,
    message: 'File could not be deleted',
    description: 'The storage provider could not delete the file. Try again later.',
  },
  FOLDER_PARENT_REQUIRED: {
    grpcCode: status.INTERNAL,
    message: 'Parent folder is required for nested folders',
    description: 'A nested folder was created without a parent folder.',
  },
  STORAGE_HANDLERS_NOT_INITIALIZED: {
    grpcCode: status.UNAVAILABLE,
    message: 'File handlers not initiated',
    description: 'The storage service is not ready yet. Try again shortly.',
  },
  STORAGE_OPERATION_FAILED: {
    grpcCode: status.INTERNAL,
    message: 'Storage operation failed',
    description:
      'The storage provider or a dependent service failed to complete the operation.',
  },
});
