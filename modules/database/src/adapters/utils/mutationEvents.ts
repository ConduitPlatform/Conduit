import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';

export const MUTATION_EVENT_ID_CHUNK_SIZE = 500;
export const MUTATION_EVENT_ID_PAGE_SIZE = MUTATION_EVENT_ID_CHUNK_SIZE;
export const MAX_MUTATION_EVENT_COLLECT_IDS = 10_000;

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

export function mutationIdCollectionExhaustedError(
  cap: number = MAX_MUTATION_EVENT_COLLECT_IDS,
): GrpcError {
  return new GrpcError(
    status.RESOURCE_EXHAUSTED,
    `updateMany matched more than ${cap} documents; refuse unbounded mutation event collection`,
  );
}

export async function collectBoundedMutationIds(args: {
  findPage: (skip: number, limit: number) => Promise<unknown>;
  cap?: number;
  pageSize?: number;
}): Promise<string[]> {
  const cap = args.cap ?? MAX_MUTATION_EVENT_COLLECT_IDS;
  const pageSize = args.pageSize ?? MUTATION_EVENT_ID_PAGE_SIZE;
  if (!Number.isInteger(cap) || cap < 1 || !Number.isInteger(pageSize) || pageSize < 1) {
    throw mutationIdCollectionExhaustedError(cap);
  }
  const ids: string[] = [];
  let skip = 0;
  while (ids.length <= cap) {
    const remainingWithOverflowProbe = cap - ids.length + 1;
    const limit = Math.min(pageSize, remainingWithOverflowProbe);
    const page = await args.findPage(skip, limit);
    const pageLength = Array.isArray(page) ? page.length : page == null ? 0 : 1;
    if (!pageLength) break;
    skip += pageLength;
    const pageIds = collectDocumentIds(page);
    if (ids.length + pageIds.length > cap) {
      throw mutationIdCollectionExhaustedError(cap);
    }
    ids.push(...pageIds);
    if (pageLength < limit) break;
  }
  return ids;
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
