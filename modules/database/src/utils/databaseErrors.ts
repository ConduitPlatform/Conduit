import { isGrpcStatusError } from '@conduitplatform/grpc-sdk';
import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';

function causeText(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause ?? '');
}

function uniqueConflictFields(cause: any): string[] {
  if (cause?.keyPattern && typeof cause.keyPattern === 'object') {
    return Object.keys(cause.keyPattern);
  }
  if (cause?.keyValue && typeof cause.keyValue === 'object') {
    return Object.keys(cause.keyValue);
  }
  if (Array.isArray(cause?.errors)) {
    const paths = cause.errors
      .map((e: any) => e?.path)
      .filter((p: unknown): p is string => typeof p === 'string');
    if (paths.length) return paths;
  }
  if (cause?.fields && typeof cause.fields === 'object') {
    return Object.keys(cause.fields);
  }
  return [];
}

function isUniqueViolation(cause: any): boolean {
  return (
    cause?.code === 11000 ||
    cause?.code === 11001 ||
    cause?.name === 'SequelizeUniqueConstraintError'
  );
}

function isValidationFailure(cause: any): boolean {
  return (
    cause?.name === 'ValidationError' ||
    cause?.name === 'CastError' ||
    cause?.name === 'SequelizeValidationError'
  );
}

/**
 * Classifies a driver error: gRPC/typed errors pass through, unique-index violations
 * and validation/cast failures become typed client errors, anything else becomes
 * `fallback` with the raw text kept for the log only.
 */
export function toDatabaseError(
  cause: unknown,
  fallback = errors.DATABASE_OPERATION_FAILED,
): Error {
  if (isGrpcStatusError(cause)) return cause;
  const text = causeText(cause);
  if (isUniqueViolation(cause)) {
    const fields = uniqueConflictFields(cause);
    const definition = fields.length
      ? {
          ...errors.DOCUMENT_UNIQUE_CONFLICT,
          message: `A document with the same unique value already exists (${fields.join(', ')})`,
        }
      : errors.DOCUMENT_UNIQUE_CONFLICT;
    return new ModuleError(definition, text || undefined);
  }
  if (isValidationFailure(cause)) {
    const definition = text
      ? { ...errors.DOCUMENT_VALIDATION_FAILED, message: text }
      : errors.DOCUMENT_VALIDATION_FAILED;
    return new ModuleError(definition, text || undefined);
  }
  return new ModuleError(fallback, text || undefined);
}

export function rethrowDatabaseError(
  fallback = errors.DATABASE_OPERATION_FAILED,
): (cause: unknown) => never {
  return (cause: unknown) => {
    throw toDatabaseError(cause, fallback);
  };
}
