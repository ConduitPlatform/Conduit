export type ConfigReconcileState = 'reconciling' | 'reconcile-done';

export type ConfigBusMessage =
  | { kind: 'unknown'; raw: string }
  | { kind: 'invalid'; reason: string }
  | { kind: 'reconcile'; state: ConfigReconcileState }
  | { kind: 'module-health'; name: string; url: string; status: number }
  | { kind: 'serving-modules-update'; name: string; url: string }
  | { kind: 'ignore' };

/**
 * The `config` channel carries JSON service-discovery messages and the
 * bare-string reconcile signals `reconciling` and `reconcile-done`. Any other
 * non-JSON message is `unknown`, which is legitimate and not an error.
 */
export function parseConfigBusMessage(message: string): ConfigBusMessage {
  if (message === 'reconciling' || message === 'reconcile-done') {
    return { kind: 'reconcile', state: message };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(message);
  } catch {
    return { kind: 'unknown', raw: message };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { kind: 'ignore' };
  }
  const record = parsed as Record<string, unknown>;
  if (record.type === 'module-health') {
    if (
      typeof record.name !== 'string' ||
      typeof record.url !== 'string' ||
      typeof record.status !== 'number'
    ) {
      return { kind: 'invalid', reason: 'module-health requires name, url, status' };
    }
    return {
      kind: 'module-health',
      name: record.name,
      url: record.url,
      status: record.status,
    };
  }
  if (record.type === 'serving-modules-update') {
    if (typeof record.name !== 'string' || typeof record.url !== 'string') {
      return { kind: 'invalid', reason: 'serving-modules-update requires name, url' };
    }
    return { kind: 'serving-modules-update', name: record.name, url: record.url };
  }
  return { kind: 'ignore' };
}
