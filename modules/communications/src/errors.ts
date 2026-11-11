import { status } from '@grpc/grpc-js';
import { defineErrors } from '@conduitplatform/grpc-sdk';

export const errors = defineErrors({
  // Templates
  TEMPLATE_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'Template does not exist',
    description: 'No email or communication template matches the given id or name',
  },
  TEMPLATE_NAME_TAKEN: {
    grpcCode: status.ALREADY_EXISTS,
    message: 'A template with this name already exists',
    description:
      'The template name is already used by another template, choose a different name',
  },
  TEMPLATE_NAME_REQUIRED: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Template name is required',
    description: 'The template name is empty, provide a non-empty name',
  },
  TEMPLATE_CHANNELS_REQUIRED: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'At least one channel is required',
    description: 'The template does not define any channel, add at least one',
  },
  TEMPLATE_DUPLICATE_CHANNELS: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Duplicate channels are not allowed',
    description: 'The template lists the same channel more than once',
  },
  INVALID_CHANNEL: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid channel',
    description: 'The channel must be one of email, push or sms',
  },
  TEMPLATE_CHANNEL_INCOMPLETE: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Template channel content is incomplete',
    description:
      'A template channel is missing required content (email subject and body, push title and body, or sms message)',
  },
  TEMPLATE_CHANNEL_NOT_INCLUDED: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Template does not include the requested channel',
    description: 'The template does not define the channel the message is sent through',
  },
  TEMPLATE_ID_OR_NAME_REQUIRED: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Either id or name must be provided',
    description: 'Provide the id or the name of the template to retrieve',
  },
  EXTERNAL_TEMPLATES_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'No external templates could be retrieved',
    description: 'The email provider did not return any external templates',
  },

  // Email
  EMAIL_OPERATION_UNSUPPORTED: {
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Operation is not supported by the configured email transport',
    description:
      'The configured email transport does not support this operation, such as managing external templates or fetching delivery status',
  },
  EMAIL_NOT_CONFIGURED: {
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Email is not configured',
    description: 'The email channel is inactive or its transport failed to initialize',
  },
  EMAIL_CONTENT_REQUIRED: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Template or body and subject must be provided',
    description: 'Provide either a template, or both a body and a subject',
  },
  EMAIL_SENDING_DOMAIN_NOT_SET: {
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Sending domain is not set and sender address is not valid',
    description:
      'Configure a sending domain, or provide a full sender address containing @',
  },
  EMAIL_RECORD_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'Email record does not exist',
    description: 'No stored email record matches the given id',
  },
  EMAIL_CONTENT_FILE_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'Email content file not found',
    description: 'The stored content of the email record could not be found',
  },
  STORAGE_UNAVAILABLE: {
    grpcCode: status.INTERNAL,
    message: 'Storage is not available',
    description: 'The storage module required for this operation is not available',
  },

  // SMS
  SMS_NOT_CONFIGURED: {
    grpcCode: status.FAILED_PRECONDITION,
    message: 'SMS is not configured',
    description: 'The SMS channel is inactive or has no usable provider configuration',
  },
  SMS_VERIFICATION_NOT_CONFIGURED: {
    grpcCode: status.FAILED_PRECONDITION,
    message: 'SMS verification is not configured',
    description: 'The SMS provider has no verification service configured',
  },
  SMS_RECORD_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'SMS record does not exist',
    description: 'No stored SMS record matches the given id',
  },
  SMS_RECIPIENT_REQUIRED: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'SMS recipient is required',
    description: 'Provide the phone number to send the verification code to',
  },
  VERIFICATION_PARAMS_REQUIRED: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Verification id and code are required',
    description: 'Provide both the verification id and the code to verify',
  },

  // Push
  PUSH_NOT_CONFIGURED: {
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Push notifications are not configured',
    description: 'The push channel is inactive or its provider failed to initialize',
  },
  RECIPIENT_TOKENS_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'No notification token found for the recipient',
    description: 'None of the recipients has a registered device token',
  },
  NOTIFICATION_TOKEN_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'Notification token does not exist',
    description: 'No notification token matches the given id',
  },
  NOTIFICATION_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'Notification not found',
    description: 'No notification matches the given id',
  },
  INVALID_SILENT_NOTIFICATION: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Silent notifications cannot have a title or body and must include data',
    description:
      'A silent notification must not contain a title or body, and must contain data',
  },
  NOTIFICATION_READ_PARAMS_REQUIRED: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Either before or id must be provided',
    description: 'Provide either a before date or a notification id',
  },
  PUSH_PLATFORM_UNSUPPORTED: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Unsupported push platform',
    description: 'The configured push provider does not support the given platform',
  },
  PUSH_RECIPIENTS_REQUIRED: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'sendTo is required and must be a non-empty array',
    description: 'Provide a non-empty list of recipients',
  },
  PUSH_NOTIFICATIONS_REQUIRED: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'notifications is required and must be a non-empty array',
    description: 'Provide a non-empty list of notifications',
  },

  // Multi-channel sending
  NO_AVAILABLE_CHANNELS: {
    grpcCode: status.FAILED_PRECONDITION,
    message: 'No available channels',
    description: 'None of the requested channels is configured',
  },
  COMMUNICATION_CHANNEL_UNAVAILABLE: {
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Channel is not available',
    description: 'The requested channel is not configured',
  },
  CHANNEL_SEND_FAILED: {
    grpcCode: status.INTERNAL,
    message: 'Failed to send to one or more channels',
    description:
      'At least one channel failed while all channels were required to succeed',
  },
  ALL_CHANNELS_FAILED: {
    grpcCode: status.INTERNAL,
    message: 'All fallback channels failed',
    description: 'Every channel in the fallback chain failed to deliver the message',
  },

  // Generic
  INVALID_JSON_PAYLOAD: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid JSON in request field',
    description: 'A request field that must contain JSON could not be parsed',
  },
  EMAIL_PROVIDER_ERROR: {
    grpcCode: status.INTERNAL,
    message: 'Email provider request failed',
    description: 'The email provider rejected the request or could not be reached',
  },
  SMS_PROVIDER_ERROR: {
    grpcCode: status.INTERNAL,
    message: 'SMS provider request failed',
    description: 'The SMS provider rejected the request or could not be reached',
  },
  PUSH_PROVIDER_ERROR: {
    grpcCode: status.INTERNAL,
    message: 'Push provider request failed',
    description: 'The push provider rejected the request or could not be reached',
  },
  COMMUNICATIONS_DATABASE_ERROR: {
    grpcCode: status.INTERNAL,
    message: 'Database operation failed',
    description: 'A database operation failed, try again later',
  },
});
