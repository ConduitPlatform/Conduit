const WELL_KNOWN_SECRET_KEYS =
  /^(apiKey|api_key|password|secret|privateKey|private_key)$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSchemaLeaf(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    ('default' in value || 'format' in value || 'type' in value) &&
    !isRecord(value._cvtProperties)
  );
}

function isSensitiveLeaf(value: unknown): boolean {
  return isSchemaLeaf(value) && value.sensitive === true;
}

function unwrapSchema(schema: unknown): unknown {
  if (isRecord(schema) && isRecord(schema._cvtProperties)) {
    return schema._cvtProperties;
  }
  return schema;
}

export function redactSensitiveConfig<T>(config: T, schema?: unknown): T {
  if (!isRecord(config)) return config;
  const redacted = Array.isArray(config) ? [...config] : { ...config };
  const node = unwrapSchema(schema);
  for (const [key, value] of Object.entries(redacted as Record<string, unknown>)) {
    const childSchema = isRecord(node) ? node[key] : undefined;
    if (isSensitiveLeaf(childSchema) || WELL_KNOWN_SECRET_KEYS.test(key)) {
      if (typeof value === 'string' && value.length > 0) {
        (redacted as Record<string, unknown>)[key] = '[REDACTED]';
      }
      continue;
    }
    if (isRecord(value) || Array.isArray(value)) {
      (redacted as Record<string, unknown>)[key] = redactSensitiveConfig(
        value,
        childSchema,
      );
    }
  }
  return redacted as T;
}
