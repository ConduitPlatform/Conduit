import { Indexable } from '@conduitplatform/grpc-sdk';

function isConvictLeaf(node: unknown): boolean {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return false;
  }
  return 'format' in node || 'default' in node || 'type' in node || 'env' in node;
}

/** Keeps only keys declared in a Convict schema document. */
export function stripUndeclaredConfigParams(
  schema: Indexable,
  config: Indexable,
): Indexable {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return config;
  }
  const result: Indexable = {};
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
