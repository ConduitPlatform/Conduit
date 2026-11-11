import {
  getConduitCode,
  hasConduitCode as sdkHasConduitCode,
} from '@conduitplatform/grpc-sdk';

/*
 * Small pure helpers shared by the realm code (no database or grpc access).
 */

export function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A string with at least one non-whitespace character. */
export function filled(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * The `conduitCode` of an error thrown by this module or returned by another module's
 * gRPC client; undefined for errors without one.
 */
export function parseConduitCode(err: unknown): string | undefined {
  return getConduitCode(err);
}

/** Whether `err` carries this error definition's `conduitCode`. */
export function hasConduitCode(err: unknown, definition: { conduitCode: string }) {
  return sdkHasConduitCode(err, definition);
}
