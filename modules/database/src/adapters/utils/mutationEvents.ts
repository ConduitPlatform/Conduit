export const MUTATION_EVENT_ID_CHUNK_SIZE = 500;

export type MutationOperation =
  'create' | 'createMany' | 'update' | 'updateMany' | 'delete';

export function shouldPublishMutationEvent(suppressEvent?: boolean): boolean {
  return suppressEvent !== true;
}

export function mutationEventChannel(
  moduleName: string,
  operation: MutationOperation,
  schemaName: string,
): string {
  return `${moduleName}:${operation}:${schemaName}`;
}

export function chunkItems<T>(
  items: T[],
  size: number = MUTATION_EVENT_ID_CHUNK_SIZE,
): T[][] {
  const chunkSize = size > 0 ? size : MUTATION_EVENT_ID_CHUNK_SIZE;
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

export function collectDocumentIds(docs: unknown): string[] {
  if (isMongoBulkWriteResult(docs)) return [];
  const values = Array.isArray(docs) ? docs : docs == null ? [] : [docs];
  const ids = new Set<string>();
  for (const value of values) {
    const id = extractId(value);
    if (id) ids.add(id);
  }
  return [...ids];
}

export function toIdEventPayload(ids: string[]): { _id: string }[] {
  return ids.map(_id => ({ _id }));
}

export function buildMutationEventChunks(
  ids: string[],
  chunkSize: number = MUTATION_EVENT_ID_CHUNK_SIZE,
): string[] {
  return chunkItems(
    ids.filter(id => id.length > 0),
    chunkSize,
  ).map(chunk => JSON.stringify(toIdEventPayload(chunk)));
}

function extractId(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string' || typeof value === 'number') {
    const id = String(value);
    return id.length ? id : undefined;
  }
  if (typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if (record._id !== undefined) return extractId(record._id);
  if (record.id !== undefined) return extractId(record.id);
  return undefined;
}

function isMongoBulkWriteResult(payload: unknown): boolean {
  if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) {
    return false;
  }
  const record = payload as Record<string, unknown>;
  if (record._id !== undefined) return false;
  return (
    typeof record.matchedCount === 'number' ||
    typeof record.modifiedCount === 'number' ||
    typeof record.nModified === 'number' ||
    typeof record.n === 'number'
  );
}
