import { status } from '@grpc/grpc-js';
import { defineErrors } from '@conduitplatform/grpc-sdk';

export const errors = defineErrors({
  // Function lookup and identity
  FUNCTION_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'Function does not exist',
    description: 'No function matches the given id. Check the id and try again.',
  },
  FUNCTION_ALREADY_EXISTS: {
    grpcCode: status.ALREADY_EXISTS,
    message: 'function name already exists',
    description: 'Another function already uses this name. Choose a different name.',
  },
  FUNCTION_ID_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid id',
    description: 'The function id (or list of ids) is missing or empty.',
  },

  // Function definition validation
  FUNCTION_CODE_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid function code',
    description: 'The function body is not valid JavaScript and could not be compiled.',
  },
  FUNCTION_METHOD_REQUIRED: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Method is required',
    description: 'Request and webhook functions must define an HTTP method.',
  },
  FUNCTION_EVENT_REQUIRED: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Event is required',
    description: 'Event functions must define the event they subscribe to.',
  },

  // Cron configuration
  CRON_PATTERN_REQUIRED: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Cron pattern is required (inputs.cronPattern or inputs.event)',
    description: 'Cron functions must define a cron pattern.',
  },
  CRON_PATTERN_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message:
      'Invalid cron pattern. Expected 5-field format: minute hour day month weekday',
    description: 'The cron pattern could not be parsed. Use the 5-field cron format.',
  },
  CRON_TIMEZONE_INVALID: {
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid timezone. Use an IANA name (e.g. UTC, Europe/Athens)',
    description: 'The timezone is not a valid IANA timezone name.',
  },

  // Function execution
  FUNCTION_EXECUTION_FAILED: {
    grpcCode: status.INTERNAL,
    message: 'Execution failed',
    description:
      'The function failed while running. Details are available in the function executions list.',
  },
  FUNCTION_EXECUTION_TIMEOUT: {
    grpcCode: status.DEADLINE_EXCEEDED,
    message: 'Function execution timed out',
    description: 'The function did not finish within its configured timeout.',
  },
  FUNCTION_COMPILATION_FAILED: {
    grpcCode: status.INTERNAL,
    message: 'Compilation failed',
    description: 'The stored function body could not be compiled.',
  },
});
