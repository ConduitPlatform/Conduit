const META_FIELDS = new Set(['_id', 'id', 'createdAt', 'updatedAt', '__v']);

export interface ParsedMutationEvent {
  payload: unknown;
  ids: string[];
}

export const MAX_MUTATION_EVENT_BYTES = 256 * 1024;
export const MAX_MUTATION_EVENT_IDS = 500;

export type MutationEventParseResult =
  | { ok: true; event: ParsedMutationEvent }
  | { ok: false; reason: 'malformed' | 'capped' };

export function parseMutationEvent(message: string): ParsedMutationEvent | null {
  const parsed = parseBoundedMutationEvent(message);
  return parsed.ok ? parsed.event : null;
}

export function parseBoundedMutationEvent(
  message: string,
  maxIds: number = MAX_MUTATION_EVENT_IDS,
): MutationEventParseResult {
  if (typeof message !== 'string' || !message.length) {
    return { ok: false, reason: 'malformed' };
  }
  if (message.length > MAX_MUTATION_EVENT_BYTES) {
    return { ok: false, reason: 'capped' };
  }
  let payload: unknown;
  try {
    payload = JSON.parse(message);
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  const ids = uniqueIds(extractDocumentIds(payload));
  if (ids.length > maxIds) {
    return { ok: false, reason: 'capped' };
  }
  return {
    ok: true,
    event: { payload, ids },
  };
}

export function extractDocumentIds(payload: unknown): string[] {
  if (payload == null) return [];
  if (isMongoBulkWriteResult(payload)) return [];
  if (isIdEnvelope(payload)) {
    return uniqueIds((payload.ids as unknown[]).map(extractId).filter(isPresent));
  }
  const docs = normalizeDocs(payload);
  return uniqueIds(docs.map(extractId).filter(isPresent));
}

export function embeddingOwnedFields(configs: Array<{ targetField: string }>): string[] {
  return configs.flatMap(config => [
    config.targetField,
    `${config.targetField}SourceHash`,
  ]);
}

export function isEmbeddingOwnedMutation(
  payload: unknown,
  ownedFields: string[] = [],
): boolean {
  const docs = normalizeDocs(payload);
  if (!docs.length) return false;
  const owned = new Set(ownedFields);
  return docs.every(doc => {
    const keys = Object.keys(doc).filter(key => !META_FIELDS.has(key));
    if (!keys.length) return false;
    return keys.every(
      key => owned.has(key) || key.endsWith('SourceHash') || isNumericVector(doc[key]),
    );
  });
}

function normalizeDocs(payload: unknown): Record<string, unknown>[] {
  if (payload == null || isMongoBulkWriteResult(payload)) return [];
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }
  if (isRecord(payload)) return [payload];
  return [];
}

function isMongoBulkWriteResult(payload: unknown): boolean {
  if (!isRecord(payload) || payload._id !== undefined) return false;
  return (
    typeof payload.matchedCount === 'number' ||
    typeof payload.modifiedCount === 'number' ||
    typeof payload.nModified === 'number' ||
    typeof payload.n === 'number'
  );
}

function isIdEnvelope(payload: unknown): payload is { ids: unknown[] } {
  return isRecord(payload) && Array.isArray(payload.ids);
}

function extractId(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string' || typeof value === 'number') {
    const id = String(value);
    return id.length ? id : undefined;
  }
  if (!isRecord(value)) return undefined;
  if (value._id !== undefined) return extractId(value._id);
  if (value.id !== undefined) return extractId(value.id);
  return undefined;
}

function isNumericVector(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(item => typeof item === 'number')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function isPresent(value: string | undefined): value is string {
  return Boolean(value);
}
