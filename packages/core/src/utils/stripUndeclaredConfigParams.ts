/**
 * Convict `getProperties()` retains undeclared keys that were loaded into the config.
 * After schema removals (e.g. transports.proxy), stored config can still contain those
 * keys; merging them back in and validating with `allowed: 'strict'` fails.
 * This keeps only keys declared in the Convict schema document.
 */
function isConvictLeaf(node: unknown): boolean {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return false;
  }
  const record = node as Record<string, unknown>;
  return 'format' in record || 'default' in record || 'type' in record || 'env' in record;
}

export function stripUndeclaredConfigParams(
  schema: Record<string, any>,
  config: Record<string, any> | null | undefined,
): Record<string, any> {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return config as Record<string, any>;
  }
  const result: Record<string, any> = {};
  for (const key of Object.keys(schema)) {
    if (!(key in config)) continue;
    const schemaNode = schema[key];
    if (isConvictLeaf(schemaNode)) {
      result[key] = config[key];
    } else if (schemaNode && typeof schemaNode === 'object') {
      result[key] = stripUndeclaredConfigParams(schemaNode, config[key]);
    }
  }
  return result;
}
