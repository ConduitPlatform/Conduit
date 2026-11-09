export type ConfigReconcileState = 'reconciling' | 'reconcile-done';

export type ConfigBusMessage =
  | { kind: 'malformed'; error: string }
  | { kind: 'reconcile'; state: ConfigReconcileState }
  | { kind: 'module-health'; name: string; url: string; status: number }
  | { kind: 'serving-modules-update'; name: string; url: string }
  | { kind: 'ignore' };

const RECONCILE_TYPE = 'config-reconcile';

export function configReconcileMessage(reconciling: boolean): string {
  const state: ConfigReconcileState = reconciling ? 'reconciling' : 'reconcile-done';
  return JSON.stringify({ type: RECONCILE_TYPE, state });
}

/**
 * The `config` channel carries JSON service-discovery messages and the
 * config-reconcile signal. Older cores publish the reconcile signal as the
 * bare strings `reconciling` and `reconcile-done`.
 */
export function parseConfigBusMessage(message: string): ConfigBusMessage {
  if (message === 'reconciling' || message === 'reconcile-done') {
    return { kind: 'reconcile', state: message };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(message);
  } catch (error) {
    return {
      kind: 'malformed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { kind: 'ignore' };
  }
  const record = parsed as Record<string, unknown>;
  if (record.type === RECONCILE_TYPE) {
    if (record.state === 'reconciling' || record.state === 'reconcile-done') {
      return { kind: 'reconcile', state: record.state };
    }
    return { kind: 'ignore' };
  }
  if (record.type === 'module-health' && typeof record.name === 'string') {
    if (typeof record.url !== 'string' || typeof record.status !== 'number') {
      return { kind: 'ignore' };
    }
    return {
      kind: 'module-health',
      name: record.name,
      url: record.url,
      status: record.status,
    };
  }
  if (
    record.type === 'serving-modules-update' &&
    typeof record.name === 'string' &&
    typeof record.url === 'string'
  ) {
    return { kind: 'serving-modules-update', name: record.name, url: record.url };
  }
  return { kind: 'ignore' };
}
