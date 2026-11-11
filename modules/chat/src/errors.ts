import { status } from '@grpc/grpc-js';
import { defineErrors } from '@conduitplatform/grpc-sdk';

export const errors = defineErrors({
  // Rooms
  ROOM_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'Room does not exist',
    description: 'The chat room does not exist or has been deleted',
  },
  ROOM_NOT_FOUND_OR_NO_ACCESS: {
    grpcCode: status.NOT_FOUND,
    message: "Room does not exist or you don't have access",
    description:
      'The room does not exist or you are not a participant. The two cases are deliberately not distinguished',
  },
  ROOM_IDS_REQUIRED: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'ids is required and must be a non-empty array',
    description: 'Provide a non-empty list of room ids to delete',
  },
  // Users
  SENDER_USER_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'Sender user does not exist',
    description: 'The sender user used as a message filter does not exist',
  },
  USERS_NOT_FOUND: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'One or more users do not exist',
    description: 'At least one of the provided user ids does not exist',
  },
  USERS_REQUIRED: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'users is required and must be a non-empty array',
    description: 'Provide a non-empty list of user ids',
  },
  USERS_ALREADY_IN_ROOM: {
    grpcCode: status.ALREADY_EXISTS,
    message: 'users array contains existing member ids',
    description:
      'At least one of the provided users is already a participant of the room',
  },
  USERS_ALREADY_INVITED: {
    grpcCode: status.ALREADY_EXISTS,
    message: 'users array contains invited member ids',
    description:
      'At least one of the provided users has already been invited to the room',
  },
  USERS_NOT_IN_ROOM: {
    grpcCode: status.NOT_FOUND,
    message: 'None of the specified users are room participants',
    description: 'None of the provided users are participants of the room',
  },
  // Messages
  MESSAGE_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: "Message does not exist or you don't have access",
    description:
      'The message does not exist, has been deleted, or you are not allowed to access it',
  },
  MESSAGE_IDS_REQUIRED: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'ids is required and must be a non-empty array',
    description: 'Provide a non-empty list of message ids to delete',
  },
  MESSAGE_EDIT_DISABLED: {
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Message editing is disabled',
    description: 'Message editing is turned off in the chat configuration',
  },
  MESSAGE_DELETE_DISABLED: {
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Message deletion is disabled',
    description: 'Message deletion is turned off in the chat configuration',
  },
  INVALID_MESSAGE_TYPE: {
    grpcCode: status.INVALID_ARGUMENT,
    message:
      'Invalid contentType, must be one of: text, file, typing, multimedia, system',
    description: 'The message contentType is not supported',
  },
  MESSAGE_FILES_REQUIRED: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Files are required for file and multimedia messages',
    description: 'File and multimedia messages must include at least one file',
  },
  MESSAGE_FILES_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Files must be an array for file and multimedia messages',
    description: 'The files property of the message must be an array',
  },
  MESSAGE_CONTENT_REQUIRED: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'text, multimedia and system messages need to have content',
    description: 'Text, multimedia and system messages must have non-empty content',
  },
  MESSAGE_CONTENT_TYPE_MISSING: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Message must contain contentType property',
    description: 'The message object must include a contentType property',
  },
  INVALID_MESSAGE_NONCE: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'When provided, nonce must be a non-empty string',
    description: 'The message nonce, when provided, must be a non-empty string',
  },
  // Invitations
  INVITATION_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'Invitation not valid',
    description: 'The invitation does not exist',
  },
  INVITATION_IDS_REQUIRED: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'invitations is required and must be a non-empty array',
    description: 'Provide a non-empty list of invitation ids to delete',
  },
  INVITATION_CANCEL_NOT_ALLOWED: {
    grpcCode: status.PERMISSION_DENIED,
    message: "You can't cancel an invitation which is not sent by you",
    description: 'Only the sender of an invitation can cancel it',
  },
  INVITATION_NOT_FOR_USER: {
    grpcCode: status.PERMISSION_DENIED,
    message: 'Invitation is not for the current user',
    description: 'The invitation was sent to a different user',
  },
  INVALID_INVITATION_ANSWER: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Answer must be accept or decline',
    description: 'The invitation answer must be either accept or decline',
  },
  INVITATION_REDIRECT_MISCONFIGURED: {
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Invitation login redirect is not configured correctly',
    description: 'The invitation login redirect is not configured correctly',
  },
  INVITATION_DELIVERY_FAILED: {
    grpcCode: status.INTERNAL,
    message: 'Failed to deliver the invitation',
    description: 'The invitation could not be delivered to the invited user',
  },
  // Generic
  CHAT_DATABASE_ERROR: {
    grpcCode: status.INTERNAL,
    message: 'Database operation failed',
    description: 'A database operation failed while processing the request',
  },
  CHAT_OPERATION_FAILED: {
    grpcCode: status.INTERNAL,
    message: 'Chat operation failed',
    description: 'The chat operation failed unexpectedly',
  },
  MESSAGE_NOT_SAVED: {
    grpcCode: status.INTERNAL,
    message: 'Message could not be saved',
    description: 'The message could not be persisted',
  },
});
