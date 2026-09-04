import { MAX_OUTPUT_BYTES, MAX_TEMPLATE_BYTES, MAX_TEMPLATE_DEPTH } from './constants.js';
import { lookupOwnPath, parseDotPath } from './path.js';
import { EventRelayValidationError } from './validationError.js';

const PLACEHOLDER = /\{\{\s*payload\.([A-Za-z_][A-Za-z0-9_.]*)\s*\}\}/g;
const EXACT_PLACEHOLDER = /^\{\{\s*payload\.([A-Za-z_][A-Za-z0-9_.]*)\s*\}\}$/;

export function assertTemplateSize(template: unknown): void {
  let serialized: string;
  try {
    serialized = JSON.stringify(template);
  } catch {
    throw new EventRelayValidationError('Message template must be valid JSON');
  }
  if (serialized === undefined) {
    throw new EventRelayValidationError('Message template must be valid JSON');
  }
  if (Buffer.byteLength(serialized, 'utf8') > MAX_TEMPLATE_BYTES) {
    throw new EventRelayValidationError(
      `Message template exceeds ${MAX_TEMPLATE_BYTES} bytes`,
    );
  }
  walkTemplate(template, 0, (value, depth) => {
    if (depth > MAX_TEMPLATE_DEPTH) {
      throw new EventRelayValidationError(
        `Message template exceeds ${MAX_TEMPLATE_DEPTH} nested levels`,
      );
    }
    if (typeof value === 'string') {
      validatePlaceholders(value);
    }
  });
}

export function renderMessageTemplate(template: unknown, payload: unknown): unknown {
  assertTemplateSize(template);
  const rendered = renderValue(template, payload, 0);
  const serialized = JSON.stringify(rendered);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_OUTPUT_BYTES) {
    throw new EventRelayValidationError(
      `Rendered message exceeds ${MAX_OUTPUT_BYTES} bytes`,
    );
  }
  return rendered;
}

function renderValue(value: unknown, payload: unknown, depth: number): unknown {
  if (depth > MAX_TEMPLATE_DEPTH) {
    throw new EventRelayValidationError(
      `Message template exceeds ${MAX_TEMPLATE_DEPTH} nested levels`,
    );
  }
  if (typeof value === 'string') {
    return interpolateString(value, payload);
  }
  if (Array.isArray(value)) {
    return value.map(item => renderValue(item, payload, depth + 1));
  }
  if (value !== null && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      output[key] = renderValue(
        (value as Record<string, unknown>)[key],
        payload,
        depth + 1,
      );
    }
    return output;
  }
  return value;
}

function interpolateString(value: string, payload: unknown): unknown {
  const exact = value.trim().match(EXACT_PLACEHOLDER);
  if (exact) {
    parseDotPath(exact[1], 'Placeholder path');
    const resolved = lookupOwnPath(payload, exact[1]);
    if (resolved === undefined) {
      throw new EventRelayValidationError(
        `Placeholder payload.${exact[1]} was not found on the payload`,
      );
    }
    return resolved;
  }

  return value.replace(PLACEHOLDER, (_match, path: string) => {
    parseDotPath(path, 'Placeholder path');
    const resolved = lookupOwnPath(payload, path);
    if (resolved === undefined) {
      throw new EventRelayValidationError(
        `Placeholder payload.${path} was not found on the payload`,
      );
    }
    return stringifyPlaceholder(resolved);
  });
}

function stringifyPlaceholder(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return JSON.stringify(value);
}

function validatePlaceholders(value: string): void {
  const exact = value.trim().match(EXACT_PLACEHOLDER);
  if (exact) {
    parseDotPath(exact[1], 'Placeholder path');
    return;
  }
  for (const match of value.matchAll(PLACEHOLDER)) {
    parseDotPath(match[1], 'Placeholder path');
  }
}

function walkTemplate(
  value: unknown,
  depth: number,
  visit: (value: unknown, depth: number) => void,
): void {
  visit(value, depth);
  if (Array.isArray(value)) {
    for (const item of value) {
      walkTemplate(item, depth + 1, visit);
    }
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      walkTemplate(nested, depth + 1, visit);
    }
  }
}
