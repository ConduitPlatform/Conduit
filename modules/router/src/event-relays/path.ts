import { FORBIDDEN_PATH_SEGMENTS, MAX_PATH_SEGMENTS } from './constants.js';
import { EventRelayValidationError } from './validationError.js';

const PATH_SEGMENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function parseDotPath(path: string, label: string): string[] {
  const trimmed = path.trim();
  if (!trimmed) {
    throw new EventRelayValidationError(`${label} is required`);
  }
  const segments = trimmed.split('.');
  if (segments.length > MAX_PATH_SEGMENTS) {
    throw new EventRelayValidationError(`${label} exceeds ${MAX_PATH_SEGMENTS} segments`);
  }
  for (const segment of segments) {
    if (FORBIDDEN_PATH_SEGMENTS.has(segment) || !PATH_SEGMENT.test(segment)) {
      throw new EventRelayValidationError(`${label} contains an invalid path segment`);
    }
  }
  return segments;
}

export function lookupOwnPath(source: unknown, path: string): unknown {
  const segments = parseDotPath(path, 'Path');
  let current: unknown = source;
  for (const segment of segments) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    if (FORBIDDEN_PATH_SEGMENTS.has(segment)) {
      return undefined;
    }
    if (!Object.prototype.hasOwnProperty.call(current, segment)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function requireOwnPath(source: unknown, path: string, label: string): unknown {
  const value = lookupOwnPath(source, path);
  if (value === undefined) {
    throw new EventRelayValidationError(
      `${label} '${path}' was not found on the payload`,
    );
  }
  return value;
}
