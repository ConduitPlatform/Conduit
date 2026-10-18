import { ModuleError } from '@conduitplatform/module-tools';

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
 * The `conduitCode` of a ModuleError. The message of a ModuleError is a JSON string
 * (`{"conduitCode": ..., "message": ...}`); anything else yields undefined.
 */
export function parseConduitCode(err: unknown): string | undefined {
  if (!(err instanceof ModuleError)) return undefined;
  try {
    const code = (JSON.parse(err.message) as { conduitCode?: unknown } | null)
      ?.conduitCode;
    return typeof code === 'string' ? code : undefined;
  } catch {
    return undefined;
  }
}

/** Whether `err` is a ModuleError carrying this error definition's `conduitCode`. */
export function hasConduitCode(err: unknown, definition: { conduitCode: string }) {
  return parseConduitCode(err) === definition.conduitCode;
}
